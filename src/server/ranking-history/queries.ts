import { and, asc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { rankingSnapshots } from "@/server/db/schema";
import { utcMidnight } from "./snapshot";

export type RankHistory = {
  /**
   * Rank de hace ≥7 días (el snapshot más antiguo dentro de la
   * ventana de 7 días). `null` si todavía no hay suficiente
   * histórico (cuenta nueva o `ranking_snapshots` recién inicializada).
   */
  weekAgoRank: number | null;
  /**
   * Serie temporal de los últimos snapshots disponibles (≤ 7), del
   * más antiguo al más reciente. Sirve para la sparkline. `null` si
   * el user no tiene snapshots.
   */
  sparkline: number[] | null;
};

const HISTORY_DAYS = 7;

/**
 * Carga el histórico de ranking del user para el panel: la fila más
 * antigua dentro de los últimos 7 días + serie completa para
 * sparkline. Una sola query con ORDER BY ASC; el caller deriva ambas
 * cosas del mismo array.
 *
 * Si el user no tiene snapshots aún (cron no ha corrido para él),
 * devolvemos `{ weekAgoRank: null, sparkline: null }`. La UI
 * renderizará el placeholder "El histórico empieza el 11 de junio".
 */
export async function getRankHistory(db: Database, userId: string): Promise<RankHistory> {
  const since = new Date(utcMidnight().getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      rank: rankingSnapshots.rank,
      snapshotDate: rankingSnapshots.snapshotDate,
    })
    .from(rankingSnapshots)
    .where(
      and(eq(rankingSnapshots.userId, userId), gte(rankingSnapshots.snapshotDate, since)),
    )
    .orderBy(asc(rankingSnapshots.snapshotDate));

  if (rows.length === 0) {
    return { weekAgoRank: null, sparkline: null };
  }

  const first = rows[0];
  if (!first) {
    // En la práctica inalcanzable (rows.length > 0 arriba), pero TS
    // exige el guard para strictNullChecks.
    return { weekAgoRank: null, sparkline: null };
  }
  return {
    // El snapshot más antiguo de la ventana es la referencia para el
    // delta "vs hace 7 días". Si solo hay un snapshot (cuenta nueva),
    // weekAgoRank coincide con el actual → delta = 0.
    weekAgoRank: first.rank,
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
