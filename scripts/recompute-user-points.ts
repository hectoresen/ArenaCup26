/**
 * Recompone `user_points` desde la verdad inmutable: `point_events`.
 *
 * Cuándo usarlo:
 *  - Tras un incidente que dejó `user_points` desincronizado de su
 *    fuente (ver `docs/incident-2026-05-18-data-wipe.md`).
 *  - Como verificación periódica: comparar el recalculado con el actual.
 *  - Tras una migración que cambie reglas de scoring históricas.
 *
 * Lo que recalcula (por user):
 *  - `totalPoints` = SUM(points) de todos sus `point_events`.
 *  - `correctCount` = COUNT distinct `match_id` con al menos un evento
 *    de kind ∈ {simple, exact, double} y points > 0.
 *  - `simpleHits`  = COUNT distinct `match_id` con kind ∈ {simple, exact}
 *    y points > 0 (high-quality hits, tercer criterio de desempate).
 *  - `streak` + `streakMax` = scan temporal de matches ordenados por
 *    kickoff, contando rachas de hits no-bonus consecutivos.
 *
 * Lo que NO recalcula:
 *  - Predictions (intactas si no se borraron).
 *  - Achievements (independientes; `evaluateAndUnlock` re-evalúa al
 *    siguiente match scored del user).
 *
 * Uso:
 *   Dry-run (default, solo imprime):
 *     DATABASE_URL=... npx tsx scripts/recompute-user-points.ts
 *
 *   Aplicar:
 *     DATABASE_URL=... npx tsx scripts/recompute-user-points.ts --apply
 */
import { db } from "@/server/db/client";
import { matches, pointEvents, userPoints } from "@/server/db/schema";
import { asc, eq, sql } from "drizzle-orm";

type Aggregate = {
  totalPoints: number;
  correctCount: number;
  simpleHits: number;
  streak: number;
  streakMax: number;
};

async function aggregateUser(userId: string): Promise<Aggregate> {
  // 1) Suma + counts en una sola query (puro SQL agregado).
  const rows = await db
    .select({
      totalPoints: sql<number>`COALESCE(SUM(${pointEvents.points}), 0)::int`,
      correctCount: sql<number>`
        COUNT(DISTINCT CASE
          WHEN ${pointEvents.kind} IN ('simple', 'exact', 'double')
            AND ${pointEvents.points} > 0
          THEN ${pointEvents.matchId}
        END)::int
      `,
      simpleHits: sql<number>`
        COUNT(DISTINCT CASE
          WHEN ${pointEvents.kind} IN ('simple', 'exact')
            AND ${pointEvents.points} > 0
          THEN ${pointEvents.matchId}
        END)::int
      `,
    })
    .from(pointEvents)
    .where(eq(pointEvents.userId, userId));
  const totals = rows[0] ?? { totalPoints: 0, correctCount: 0, simpleHits: 0 };

  // 2) Streak: scan temporal por kickoff.
  const eventsByMatch = await db
    .select({
      matchId: pointEvents.matchId,
      kind: pointEvents.kind,
      points: pointEvents.points,
      kickoffAt: matches.kickoffAt,
    })
    .from(pointEvents)
    .leftJoin(matches, eq(matches.id, pointEvents.matchId))
    .where(eq(pointEvents.userId, userId))
    .orderBy(asc(matches.kickoffAt));

  // Agrupamos por match: un match es "hit" si tuvo al menos un evento
  // no-bonus con puntos > 0. Combo/referral son bonus, no cuentan
  // como hit independiente.
  const matchHits = new Map<string, boolean>();
  for (const row of eventsByMatch) {
    if (!row.matchId) continue;
    if (row.kind === "combo" || row.kind === "referral" || row.kind === "poll") continue;
    const isHit = row.points > 0;
    const previous = matchHits.get(row.matchId) ?? false;
    matchHits.set(row.matchId, previous || isHit);
  }

  let streak = 0;
  let streakMax = 0;
  for (const isHit of matchHits.values()) {
    if (isHit) {
      streak++;
      if (streak > streakMax) streakMax = streak;
    } else {
      streak = 0;
    }
  }

  return { ...totals, streak, streakMax };
}

async function main() {
  const apply = process.argv.includes("--apply");

  const userRows = await db.selectDistinct({ userId: pointEvents.userId }).from(pointEvents);

  console.log(`→ Encontrados ${userRows.length} users con eventos.`);
  console.log(apply ? "Modo: APPLY" : "Modo: DRY-RUN (sin tocar BD)");
  console.log("");

  let drift = 0;
  let unchanged = 0;

  for (const { userId } of userRows) {
    const computed = await aggregateUser(userId);

    const currentRows = await db
      .select({
        totalPoints: userPoints.totalPoints,
        streak: userPoints.streak,
        streakMax: userPoints.streakMax,
        correctCount: userPoints.correctCount,
        simpleHits: userPoints.simpleHits,
      })
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);

    const current = currentRows[0];
    const diff =
      !current ||
      current.totalPoints !== computed.totalPoints ||
      current.streak !== computed.streak ||
      current.streakMax !== computed.streakMax ||
      current.correctCount !== computed.correctCount ||
      current.simpleHits !== computed.simpleHits;

    if (!diff) {
      unchanged++;
      continue;
    }
    drift++;
    console.log(`Drift user ${userId.slice(0, 8)}…:`);
    console.log(`  current : ${JSON.stringify(current ?? "missing")}`);
    console.log(`  computed: ${JSON.stringify(computed)}`);

    if (apply) {
      await db
        .insert(userPoints)
        .values({
          userId,
          totalPoints: computed.totalPoints,
          streak: computed.streak,
          streakMax: computed.streakMax,
          correctCount: computed.correctCount,
          simpleHits: computed.simpleHits,
        })
        .onConflictDoUpdate({
          target: userPoints.userId,
          set: {
            totalPoints: computed.totalPoints,
            streak: computed.streak,
            streakMax: computed.streakMax,
            correctCount: computed.correctCount,
            simpleHits: computed.simpleHits,
          },
        });
    }
  }

  console.log("");
  console.log(`Resultado: ${unchanged} sin cambios, ${drift} con drift.`);
  console.log(
    apply ? "✓ Aplicado." : "(dry-run, no se persistió nada — ejecuta con --apply para escribir)",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("recompute-user-points failed:", err);
  process.exit(1);
});
