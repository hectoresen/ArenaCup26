import type { Database } from "@/server/db/client";
import { predictions, userAchievements, userPoints, users } from "@/server/db/schema";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";

/**
 * Backfill idempotente de los logros de ranking. Para cada user que
 * YA ocupe un puesto que califique para uno de estos logros, inserta
 * la fila en `user_achievements` si no la tenía.
 *
 * Motivación: `evaluateAndUnlock` solo se dispara después de scorear
 * un partido. Si un user lleva en el top-10 desde hace una semana sin
 * que haya cambiado su scoring (porque ya no ha predicho o porque sus
 * predicciones no han producido nuevos `point_events`), el sistema
 * NUNCA evalúa sus logros de rank — se quedan bloqueados aunque el
 * usuario los merezca.
 *
 * Especialmente crítico para los logros nuevos (`division-bronze/
 * silver/gold` introducidos 2026-06-17): existían usuarios en top
 * 30/20/10 antes del deploy, y los logros se añadieron al catálogo
 * después. Sin este backfill, el dashboard mostraría "0 nuevos" y
 * los users no entenderían dónde están.
 *
 * Algoritmo:
 *  1. Lista todos los users ordenados con el tie-break canónico (mismo
 *     que `getRealSnapshot`).
 *  2. Para cada user con su rank derivado del orden (i + 1), si su
 *     rank ≤ N, debería tener el logro de threshold N.
 *  3. Filtra los que ya lo tienen.
 *  4. Bulk insert con onConflictDoNothing.
 *
 * NO emite notificaciones in-app ni push — sería spam (potencialmente
 * cientos de filas en startup). El user verá el logro la próxima vez
 * que abra su perfil. Mismo razonamiento que `backfillTeamSpirit`.
 *
 * Idempotente: en deploys sucesivos, una vez todos los users elegibles
 * tienen sus logros, devuelve 0 sin hacer nada.
 *
 * Returns: número total de filas insertadas (sumadas todas las
 * combinaciones user × achievement).
 */
const RANK_RULES: Array<{ id: string; maxRank: number }> = [
  // Tier común/raro/épico: thresholds antiguos del catálogo + el
  // nuevo de la primera división del leaderboard.
  { id: "top-100", maxRank: 100 },
  { id: "top-50", maxRank: 50 },
  { id: "division-bronze", maxRank: 30 },
  // Tier legendario: top-10 (clásico) + division-silver (nuevo).
  { id: "division-silver", maxRank: 20 },
  { id: "top-10", maxRank: 10 },
  // Tier mítico: posiciones de élite + division-gold (nuevo,
  // mismo threshold que top-10 pero distinto tier narrativo).
  { id: "division-gold", maxRank: 10 },
  { id: "on-the-podium", maxRank: 3 },
  { id: "runner-up", maxRank: 2 },
  { id: "king-of-the-moment", maxRank: 1 },
];

export async function backfillRankAchievements(db: Database): Promise<number> {
  // 1) Ranking actual con tie-break canónico. Limitamos a top 100
  //    porque ningún rule supera ese threshold — bajamos lectura y
  //    coste de la query.
  const predictionCountSubq = db
    .select({
      userId: predictions.userId,
      total: sql<number>`count(*)::int`.as("pred_total"),
    })
    .from(predictions)
    .groupBy(predictions.userId)
    .as("pred_counts");

  const ranked = await db
    .select({ userId: users.id })
    .from(users)
    .leftJoin(userPoints, eq(userPoints.userId, users.id))
    .leftJoin(predictionCountSubq, eq(predictionCountSubq.userId, users.id))
    .orderBy(
      desc(sql`coalesce(${userPoints.totalPoints}, 0)`),
      desc(sql`coalesce(${userPoints.streakMax}, 0)`),
      desc(sql`coalesce(${userPoints.simpleHits}, 0)`),
      desc(sql`coalesce(${predictionCountSubq.total}, 0)`),
      asc(users.createdAt),
    )
    .limit(100);

  if (ranked.length === 0) return 0;

  // 2) Filas existentes para los achievementIds del backfill — un
  //    Set `userId:achievementId` para lookup O(1).
  const existingRows = await db
    .select({
      userId: userAchievements.userId,
      achievementId: userAchievements.achievementId,
    })
    .from(userAchievements)
    .where(
      inArray(
        userAchievements.achievementId,
        RANK_RULES.map((r) => r.id),
      ),
    );
  const existing = new Set(existingRows.map((r) => `${r.userId}:${r.achievementId}`));

  // 3) Construir el array de inserts.
  const toInsert: Array<{ userId: string; achievementId: string }> = [];
  for (let i = 0; i < ranked.length; i++) {
    const userId = ranked[i]?.userId;
    if (!userId) continue;
    const rank = i + 1;
    for (const rule of RANK_RULES) {
      if (rank > rule.maxRank) continue;
      if (existing.has(`${userId}:${rule.id}`)) continue;
      toInsert.push({ userId, achievementId: rule.id });
    }
  }

  if (toInsert.length === 0) return 0;

  await db.insert(userAchievements).values(toInsert).onConflictDoNothing();
  return toInsert.length;
}
