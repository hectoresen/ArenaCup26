import type { Database } from "@/server/db/client";
import { rankingSnapshots } from "@/server/db/schema";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { utcMidnight } from "./snapshot";

export type RankHistory = {
  /**
   * Rank de hace ~24h (el snapshot del día anterior, si existe).
   * `null` si todavía no hay snapshot anterior (cuenta nueva o cron
   * no ha corrido aún hoy y/o ayer).
   *
   * **Cambio 2026-05-20**: antes era `weekAgoRank` (delta 7 días). El
   * Mundial dura solo 5 semanas — un delta semanal habría dado feedback
   * 2-3 veces total. Con delta diario el usuario ve evolución cada día.
   */
  dayAgoRank: number | null;
  /**
   * Serie temporal de los últimos snapshots disponibles (hasta 7
   * días), del más antiguo al más reciente. Sirve para la sparkline
   * que da contexto de tendencia. `null` si el user no tiene
   * snapshots.
   */
  sparkline: number[] | null;
};

/**
 * Ventana de la sparkline. Mantiene 7 días aunque el delta sea de
 * 24h: la sparkline ofrece contexto de tendencia (subo/bajo
 * consistentemente) que un único punto de 24h no captaría.
 */
const SPARKLINE_DAYS = 7;

/**
 * Carga el histórico de ranking del user para el panel:
 *  - `dayAgoRank` = snapshot del día anterior (1 día atrás).
 *  - `sparkline` = serie de hasta 7 días, más antiguo → reciente.
 *
 * Una sola query con ORDER BY ASC; la transform pura deriva ambas
 * cosas del mismo array + el `dayAgo` cutoff.
 *
 * Si el user no tiene snapshots aún (cuenta nueva, cron no ha
 * corrido), devolvemos `{ dayAgoRank: null, sparkline: null }`. La UI
 * renderizará el placeholder "El histórico empieza el 11 de junio".
 */
export async function getRankHistory(db: Database, userId: string): Promise<RankHistory> {
  const today = utcMidnight();
  const since = new Date(today.getTime() - SPARKLINE_DAYS * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      rank: rankingSnapshots.rank,
      snapshotDate: rankingSnapshots.snapshotDate,
    })
    .from(rankingSnapshots)
    .where(and(eq(rankingSnapshots.userId, userId), gte(rankingSnapshots.snapshotDate, since)))
    .orderBy(asc(rankingSnapshots.snapshotDate));

  return summarizeRankHistory(
    rows.map((r) => ({ rank: r.rank, snapshotDate: r.snapshotDate })),
    dayAgo,
  );
}

/**
 * Pure transform: dado un array de filas (rank + snapshotDate)
 * ordenadas ASC por fecha + el cutoff `dayAgo`, devuelve `{
 * dayAgoRank, sparkline }`. Extraída de `getRankHistory` para
 * testabilidad sin BD.
 *
 *  - `[]` → `{ dayAgoRank: null, sparkline: null }`.
 *  - Sin snapshot anterior a hoy → `dayAgoRank: null`.
 *  - El último snapshot con `snapshotDate <= dayAgo` define el rank
 *    "de hace 24h" — funciona aunque haya gaps (cron caído un día).
 */
export function summarizeRankHistory(
  rows: { rank: number; snapshotDate: Date }[],
  dayAgo: Date,
): RankHistory {
  if (rows.length === 0) {
    return { dayAgoRank: null, sparkline: null };
  }
  // El snapshot "de hace 24h" es el más reciente con fecha <= dayAgo
  // (que es utcMidnight - 1 día). rows ya viene ASC, así que rastreamos
  // el último que cumple desde el principio.
  let dayAgoRank: number | null = null;
  for (const row of rows) {
    if (row.snapshotDate.getTime() <= dayAgo.getTime()) {
      dayAgoRank = row.rank;
    } else {
      break;
    }
  }
  return {
    dayAgoRank,
    sparkline: rows.map((r) => r.rank),
  };
}

/**
 * Counter de uso interno: cuántos snapshots tiene el user en total
 * (no filtrado por ventana). Sirve para tests/diagnóstico.
 */
export async function countSnapshots(db: Database, userId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(rankingSnapshots)
    .where(eq(rankingSnapshots.userId, userId));
  return rows[0]?.total ?? 0;
}
