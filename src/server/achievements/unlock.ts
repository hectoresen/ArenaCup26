import { dlog } from "@/lib/debug-log";
import { env } from "@/lib/env";
import type { Database } from "@/server/db/client";
import {
  achievementDefinitions,
  groupMemberships,
  groups,
  invitationRedemptions,
  matches,
  pointEvents,
  userAchievements,
  userPoints,
} from "@/server/db/schema";
import { notifyWithPush } from "@/server/notifications/notify-with-push";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

/**
 * Reglas de unlock evaluables hoy a partir del estado en BD. Para
 * cada logro del catálogo, una función que devuelve `true` si el user
 * cumple. Si la función devuelve `false`, el logro permanece bloqueado.
 *
 * Algunos logros del catálogo (`the-prophet`, `the-step-before`,
 * `world-citizen`, etc.) requieren contexto específico del Mundial
 * 2026 (final, semis, "todos los partidos del torneo"). Los marcamos
 * con `null` y se evaluarán cuando el dominio Mundial esté cargado.
 *
 * Pure functions — toda la I/O necesaria la hace el caller en
 * `evaluateAndUnlock`.
 */
type UnlockContext = {
  totalPoints: number;
  streak: number;
  correctCount: number;
  exactCount: number;
  rank: number | null;
  totalUsers: number;
  /**
   * Cuántos de los invitados de este user han acertado su primera
   * predicción (redemption con `first_hit_at IS NOT NULL`). El
   * logro `better-with-friends` se desbloquea al llegar a 1.
   */
  referredFirstHits: number;
  /**
   * Número de grupos activos (memberships con `left_at IS NULL` y
   * grupo no borrado) en los que el user participa. El logro
   * `team-spirit` se desbloquea al llegar a 1.
   */
  activeGroupCount: number;
};

const UNLOCK_RULES: Record<string, (ctx: UnlockContext) => boolean> = {
  // ───── Común ─────
  "first-hit": (c) => c.correctCount >= 1,
  "good-eye": (c) => c.correctCount >= 10,
  "first-hundred": (c) => c.totalPoints >= 100,
  "five-of-five": (c) => c.exactCount >= 5,
  "better-with-friends": (c) => c.referredFirstHits >= 1,
  "team-spirit": (c) => c.activeGroupCount >= 1,

  // ───── Poco común ─────
  "power-200": (c) => c.totalPoints >= 200,
  "on-fire": (c) => c.streak >= 5,
  "exact-shot": (c) => c.exactCount >= 1,
  "top-100": (c) => c.rank !== null && c.rank <= 100,

  // ───── Épico ─────
  "elite-shooter": (c) => c.exactCount >= 10,
  "top-50": (c) => c.rank !== null && c.rank <= 50,

  // ───── Legendario ─────
  seer: (c) => c.exactCount >= 20,
  "top-10": (c) => c.rank !== null && c.rank <= 10,

  // ───── Mítico ─────
  "on-the-podium": (c) => c.rank !== null && c.rank <= 3,
  "runner-up": (c) => c.rank !== null && c.rank <= 2,
  "king-of-the-moment": (c) => c.rank === 1,
};

/**
 * Logros que requieren contexto específico del Mundial 2026 (final,
 * semifinales, "todos los partidos del torneo") y no se evalúan
 * todavía. Documentados aquí para que cualquiera vea el roadmap.
 */
const PENDING_RULES = new Set([
  "group-analyst", // necesita contar predictions en stage=group
  "total-strategist", // necesita "todos los partidos de fase de grupos"
  "half-world", // 50% de partidos del Mundial
  "the-step-before", // semifinal del Mundial
  "double-streak", // 2 rachas de 5
  "world-citizen", // todos los partidos del Mundial
  "the-prophet", // exact en la Gran Final
  "the-goat", // número 1 al finalizar el Mundial
]);

/**
 * Evalúa todos los logros para un user, desbloquea los nuevos
 * (idempotente: si ya están unlocked, no toca nada), y emite una
 * notificación `achievement_unlocked` por cada uno.
 *
 * Diseñado para ejecutarse después de `persistScore` en el pipeline
 * de scoring. Devuelve el array de IDs desbloqueados en esta llamada.
 *
 * No fallible: si la inserción de notif o de unlock falla, lo loguea
 * y continúa con los siguientes para no abortar todo el scoring.
 */
/**
 * Logros que NO están sujetos al gate global de
 * `ACHIEVEMENTS_MIN_FINISHED_MATCHES`. Pensado para achievements de
 * acción social que no dependen del rendimiento en partidos — el
 * gate fue diseñado para evitar trivialidades el día 1 del Mundial
 * (acertar una predicción suelta y llevarte el logro), pero
 * `team-spirit` no aplica esa lógica: se gana al crear/unirse a un
 * grupo, lo cual debe reconocerse al instante.
 */
const GATE_BYPASS = new Set(["team-spirit"]);

export async function evaluateAndUnlock(db: Database, userId: string): Promise<string[]> {
  // Gate global: bloqueamos los logros de RENDIMIENTO hasta que se
  // hayan jugado N matches (configurable via env). Los achievements
  // listados en `GATE_BYPASS` siguen evaluándose normalmente.
  // Pensado para el Mundial: queremos evitar que un user que
  // acierte una sola predicción el día 1 se lleve achievements de
  // forma trivial. Una vez se llegue al umbral, todos los users
  // desbloquean retroactivamente lo que les corresponda en su
  // siguiente unlock check. Default 0 → sin gate (QA).
  let gateActive = false;
  const minFinished = env.ACHIEVEMENTS_MIN_FINISHED_MATCHES;
  if (minFinished > 0) {
    const finishedRows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(matches)
      .where(eq(matches.status, "finished"));
    const finishedCount = finishedRows[0]?.total ?? 0;
    if (finishedCount < minFinished) {
      gateActive = true;
      dlog("scoring", "achievements gate active — only GATE_BYPASS will unlock", {
        userId,
        finishedCount,
        minFinished,
      });
    }
  }

  // 1) Reunir contexto del user.
  const ctx = await loadContext(db, userId);
  dlog("scoring", "evaluating achievements", { userId, ctx, gateActive });

  // 2) Ya desbloqueados — los saltamos.
  const alreadyUnlocked = new Set(
    (
      await db
        .select({ id: userAchievements.achievementId })
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId))
    ).map((r) => r.id),
  );

  // 3) Achievement definitions actuales (para verificar que el id existe).
  const validIds = new Set(
    (await db.select({ id: achievementDefinitions.id }).from(achievementDefinitions)).map(
      (r) => r.id,
    ),
  );

  const newlyUnlocked: string[] = [];
  for (const [achievementId, rule] of Object.entries(UNLOCK_RULES)) {
    if (alreadyUnlocked.has(achievementId)) continue;
    if (!validIds.has(achievementId)) continue;
    // Si el gate está activo, solo dejamos pasar los del bypass set.
    if (gateActive && !GATE_BYPASS.has(achievementId)) continue;
    if (!rule(ctx)) continue;

    try {
      await db.insert(userAchievements).values({ userId, achievementId }).onConflictDoNothing();

      const def = await db
        .select({ title: achievementDefinitions.title })
        .from(achievementDefinitions)
        .where(eq(achievementDefinitions.id, achievementId))
        .limit(1);

      await notifyWithPush({
        db,
        userId,
        kind: "achievement_unlocked",
        title: "Logro desbloqueado",
        body: def[0]?.title ?? achievementId,
        achievementId,
        pushable: true,
      });

      newlyUnlocked.push(achievementId);
      dlog("scoring", "achievement unlocked", { userId, achievementId });
    } catch (err) {
      dlog("scoring", "failed to unlock achievement", {
        userId,
        achievementId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (newlyUnlocked.length > 0) {
    dlog("scoring", `unlocked ${newlyUnlocked.length} new achievements`, {
      userId,
      ids: newlyUnlocked,
    });
  }
  return newlyUnlocked;
}

async function loadContext(db: Database, userId: string): Promise<UnlockContext> {
  // Puntos + racha + correctos del user.
  const pointsRows = await db
    .select({
      totalPoints: userPoints.totalPoints,
      streak: userPoints.streak,
      correctCount: userPoints.correctCount,
    })
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1);
  const points = pointsRows[0];

  // Número de exactos (count distinct matches con kind='exact').
  const exactRows = await db
    .select({ exact: sql<number>`count(distinct ${pointEvents.matchId})::int` })
    .from(pointEvents)
    .where(and(eq(pointEvents.userId, userId), eq(pointEvents.kind, "exact")));
  const exactCount = exactRows[0]?.exact ?? 0;

  // Rank actual.
  let rank: number | null = null;
  if (points) {
    const aheadRows = await db
      .select({ ahead: sql<number>`count(*)::int` })
      .from(userPoints)
      .where(sql`${userPoints.totalPoints} > ${points.totalPoints}`);
    rank = (aheadRows[0]?.ahead ?? 0) + 1;
  }
  const totalUsersRow = await db.select({ total: sql<number>`count(*)::int` }).from(userPoints);
  const totalUsers = totalUsersRow[0]?.total ?? 0;

  // Cuántos invitados de este user han acertado su primera
  // predicción. Source of truth: `invitation_redemptions.firstHitAt`
  // (lo setea el referral payout en el pipeline de scoring).
  const referredFirstHitsRow = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(invitationRedemptions)
    .where(
      and(eq(invitationRedemptions.inviterId, userId), isNotNull(invitationRedemptions.firstHitAt)),
    );
  const referredFirstHits = referredFirstHitsRow[0]?.total ?? 0;

  // Grupos activos del user (membership con `left_at IS NULL` + grupo
  // no borrado). Solo cuentan los grupos vivos: si abandonas todos,
  // el logro YA quedaría desbloqueado para siempre (no se revoca),
  // pero la métrica refleja la realidad actual.
  const groupCountRow = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(
      and(
        eq(groupMemberships.userId, userId),
        isNull(groupMemberships.leftAt),
        isNull(groups.deletedAt),
      ),
    );
  const activeGroupCount = groupCountRow[0]?.total ?? 0;

  return {
    totalPoints: points?.totalPoints ?? 0,
    streak: points?.streak ?? 0,
    correctCount: points?.correctCount ?? 0,
    exactCount,
    rank,
    totalUsers,
    referredFirstHits,
    activeGroupCount,
  };
}

/**
 * Set público de logros que aún NO se evalúan automáticamente. El
 * UI puede mostrarlos como "próximamente" o el tester puede ver por
 * qué un logro no se desbloquea aunque el user "cumple".
 */
export const PENDING_ACHIEVEMENT_RULES = PENDING_RULES;
