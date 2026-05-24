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
  predictions,
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
  /**
   * Cuántas veces el user ha alcanzado streak=5 a lo largo del
   * torneo. Counter en `user_points.streak_milestones_5` que se
   * incrementa cuando la racha cruza de <5 a >=5 en `persistScore`.
   * Soporta el logro `double-streak` (≥2).
   */
  streakMilestones5: number;
  /**
   * Stats agregadas para los logros del torneo. "Torneo" = todos los
   * matches en BD con `stage != 'regular-season'` (durante pre-Mundial
   * borramos cualquier match de liga regular para que solo queden los
   * del Mundial). Si esto cambia, hay que filtrar por tournamentId.
   */
  tournamentMatchesTotal: number;
  tournamentMatchesGroup: number;
  userPredictionsTotal: number;
  userPredictionsGroup: number;
  /** Acertó (cualquier kind con puntos > 0) en al menos una semi. */
  hitASemi: boolean;
  /** Hizo `exact` en la final. */
  exactInFinal: boolean;
  /**
   * El Mundial terminó = el match de stage='final' está en status
   * 'finished'. Solo entonces evaluamos `the-goat`.
   */
  tournamentEnded: boolean;
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

  // ───── Mundial-específicos ─────
  // Predijo ≥10 partidos de fase de grupos del torneo.
  "group-analyst": (c) => c.userPredictionsGroup >= 10,
  // Predijo TODOS los partidos de fase de grupos del torneo.
  "total-strategist": (c) =>
    c.tournamentMatchesGroup > 0 && c.userPredictionsGroup >= c.tournamentMatchesGroup,
  // ≥50% de los partidos del torneo predichos.
  "half-world": (c) =>
    c.tournamentMatchesTotal > 0 &&
    c.userPredictionsTotal / c.tournamentMatchesTotal >= 0.5,
  // 100% de los partidos del torneo predichos.
  "world-citizen": (c) =>
    c.tournamentMatchesTotal > 0 && c.userPredictionsTotal >= c.tournamentMatchesTotal,
  // 2 rachas distintas que llegaron al hito de 5.
  "double-streak": (c) => c.streakMilestones5 >= 2,
  // Acertó (cualquier kind con puntos>0) en una semifinal.
  "the-step-before": (c) => c.hitASemi,
  // Marcador exacto en la Gran Final.
  "the-prophet": (c) => c.exactInFinal,
  // Mundial terminado + rank 1 global.
  "the-goat": (c) => c.tournamentEnded && c.rank === 1,
};

/**
 * Logros que requieren contexto específico del Mundial 2026 (final,
 * semifinales, "todos los partidos del torneo") y no se evalúan
 * todavía. Documentados aquí para que cualquiera vea el roadmap.
 */
// Todos los logros del catálogo están ahora implementados en
// UNLOCK_RULES. El set queda vacío como contrato — si en el futuro
// añadimos achievement_definitions sin lógica de unlock, lo
// listamos aquí para que sea explícito en el código y la UI lo
// pueda renderizar como "próximamente" en vez de aparentar bug.
const PENDING_RULES = new Set<string>([]);

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
      streakMilestones5: userPoints.streakMilestones5,
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

  // Stats del torneo. "Torneo" = matches con stage != 'regular-season'
  // (durante pre-Mundial se borran las ligas regulares).
  const tournamentTotalsRow = await db
    .select({
      total: sql<number>`count(*)::int`,
      group: sql<number>`count(*) filter (where ${matches.stage} = 'group')::int`,
    })
    .from(matches)
    .where(sql`${matches.stage} != 'regular-season'`);
  const tournamentMatchesTotal = tournamentTotalsRow[0]?.total ?? 0;
  const tournamentMatchesGroup = tournamentTotalsRow[0]?.group ?? 0;

  // Predicciones del user sobre matches del torneo.
  const userPredictionsRow = await db
    .select({
      total: sql<number>`count(distinct ${predictions.matchId})::int`,
      group: sql<number>`count(distinct ${predictions.matchId}) filter (where ${matches.stage} = 'group')::int`,
    })
    .from(predictions)
    .innerJoin(matches, eq(matches.id, predictions.matchId))
    .where(
      and(eq(predictions.userId, userId), sql`${matches.stage} != 'regular-season'`),
    );
  const userPredictionsTotal = userPredictionsRow[0]?.total ?? 0;
  const userPredictionsGroup = userPredictionsRow[0]?.group ?? 0;

  // Acierto (cualquier kind con puntos > 0) en una semi.
  const semiHitRow = await db
    .select({ hit: sql<number>`count(*)::int` })
    .from(pointEvents)
    .innerJoin(matches, eq(matches.id, pointEvents.matchId))
    .where(
      and(
        eq(pointEvents.userId, userId),
        eq(matches.stage, "semi"),
        sql`${pointEvents.points} > 0`,
      ),
    );
  const hitASemi = (semiHitRow[0]?.hit ?? 0) > 0;

  // Exact en la final.
  const finalExactRow = await db
    .select({ hit: sql<number>`count(*)::int` })
    .from(pointEvents)
    .innerJoin(matches, eq(matches.id, pointEvents.matchId))
    .where(
      and(
        eq(pointEvents.userId, userId),
        eq(matches.stage, "final"),
        eq(pointEvents.kind, "exact"),
      ),
    );
  const exactInFinal = (finalExactRow[0]?.hit ?? 0) > 0;

  // El Mundial terminó = al menos una final con status 'finished'.
  const finalFinishedRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(and(eq(matches.stage, "final"), eq(matches.status, "finished")));
  const tournamentEnded = (finalFinishedRow[0]?.count ?? 0) > 0;

  return {
    totalPoints: points?.totalPoints ?? 0,
    streak: points?.streak ?? 0,
    correctCount: points?.correctCount ?? 0,
    exactCount,
    rank,
    totalUsers,
    referredFirstHits,
    activeGroupCount,
    streakMilestones5: points?.streakMilestones5 ?? 0,
    tournamentMatchesTotal,
    tournamentMatchesGroup,
    userPredictionsTotal,
    userPredictionsGroup,
    hitASemi,
    exactInFinal,
    tournamentEnded,
  };
}

/**
 * Set público de logros que aún NO se evalúan automáticamente. El
 * UI puede mostrarlos como "próximamente" o el tester puede ver por
 * qué un logro no se desbloquea aunque el user "cumple".
 */
export const PENDING_ACHIEVEMENT_RULES = PENDING_RULES;
