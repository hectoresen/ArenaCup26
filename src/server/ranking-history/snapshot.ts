import { dlog } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import { predictions, rankingSnapshots, userPoints, users } from "@/server/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";

/**
 * Devuelve la fecha UTC con la parte de tiempo a 00:00:00.000 — el
 * `snapshot_date` canónico del día actual. Sirve como clave de
 * unicidad y para querys "snapshots de hace N días".
 */
export function utcMidnight(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export type SnapshotReport = {
  /** Fecha del snapshot (00:00 UTC). */
  date: Date;
  /** Cuántas filas se insertaron o actualizaron. */
  usersSnapshotted: number;
};

/**
 * Toma un snapshot del ranking global completo y lo persiste en
 * `ranking_snapshots`. Cada user ranked se guarda con su rank actual
 * (1-based) + total de puntos.
 *
 * Tie-break idéntico al de `getRealSnapshot` para que el rank en
 * histórico coincida con el del leaderboard live:
 *  points → streakMax → simpleHits → predictionsCount → createdAt.
 *
 * Idempotente: si el snapshot del día ya existe (mismo `user_id +
 * snapshot_date`), hacemos UPSERT — sobreescribe con los valores
 * actuales. Esto permite re-correr el cron sin duplicar y también
 * snapshot manual durante el día.
 */
export async function takeRankingSnapshot(
  db: Database,
  now: Date = new Date(),
): Promise<SnapshotReport> {
  const snapshotDate = utcMidnight(now);

  // Subselect de predictions count para tie-break.
  const predictionCountSubq = db
    .select({
      userId: predictions.userId,
      total: sql<number>`count(*)::int`.as("pred_total"),
    })
    .from(predictions)
    .groupBy(predictions.userId)
    .as("pred_counts");

  // Cargamos TODOS los users registrados con su rank computado. La
  // window function `row_number()` resuelve el tie-break en SQL.
  // Aquí no usamos coalesce porque ya estamos en LEFT JOIN — Drizzle
  // entiende NULL como menor que cualquier valor por defecto en
  // PostgreSQL, así que `coalesce(.., 0)` lo hacemos explícito.
  const rows = await db
    .select({
      userId: users.id,
      totalPoints: sql<number>`coalesce(${userPoints.totalPoints}, 0)::int`,
      streakMax: sql<number>`coalesce(${userPoints.streakMax}, 0)::int`,
      simpleHits: sql<number>`coalesce(${userPoints.simpleHits}, 0)::int`,
      predictionsTotal: sql<number>`coalesce(${predictionCountSubq.total}, 0)::int`,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(userPoints, eq(userPoints.userId, users.id))
    .leftJoin(predictionCountSubq, eq(predictionCountSubq.userId, users.id))
    .orderBy(
      desc(sql`coalesce(${userPoints.totalPoints}, 0)`),
      desc(sql`coalesce(${userPoints.streakMax}, 0)`),
      desc(sql`coalesce(${userPoints.simpleHits}, 0)`),
      desc(sql`coalesce(${predictionCountSubq.total}, 0)`),
      asc(users.createdAt),
    );

  if (rows.length === 0) {
    dlog("cron", "snapshot-ranking: no users to snapshot");
    return { date: snapshotDate, usersSnapshotted: 0 };
  }

  // Insertamos por bloques. UPSERT en `(user_id, snapshot_date)`
  // para que re-correr el cron en el mismo día no duplique filas.
  const values = rows.map((row, idx) => ({
    userId: row.userId,
    rank: idx + 1,
    totalPoints: row.totalPoints,
    snapshotDate,
  }));

  await db
    .insert(rankingSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: [rankingSnapshots.userId, rankingSnapshots.snapshotDate],
      set: {
        rank: sql`excluded.rank`,
        totalPoints: sql`excluded.total_points`,
        snapshotAt: sql`now()`,
      },
    });

  dlog("cron", "snapshot-ranking: persisted", {
    date: snapshotDate.toISOString(),
    users: rows.length,
  });

  return { date: snapshotDate, usersSnapshotted: rows.length };
}
