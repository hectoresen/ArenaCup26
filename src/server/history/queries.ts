import { dlog } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import { matches, pointEvents, predictions, teams } from "@/server/db/schema";
import type { MatchStatus, PredictionKind, PredictionWinner } from "@/server/scoring/types";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { HistoryEntry } from "./types";

export type HistoryOutcomeFilter = "all" | "hit" | "miss" | "pending";

/**
 * Trae las predicciones del user con el estado del partido y los
 * puntos ganados. Ordenado por kickoff descendente (lo más reciente
 * primero).
 *
 * Filtro por outcome (server-side para que el conteo respete el
 * filtro y la paginación funcione cuando crezca):
 *  - `all` (default) → todas las predicciones.
 *  - `hit` → finished con `pointsEarned > 0` (acertó).
 *  - `miss` → finished con `pointsEarned = 0` (falló o sin event).
 *  - `pending` → status != finished (sin scoring todavía).
 *
 * Implementación:
 *  - JOIN `predictions ↔ matches ↔ teams×2` para tener todo en una
 *    sola query.
 *  - LEFT JOIN al subselect de `point_events` agrupados por matchId
 *    para sumar los puntos del user en ese partido.
 *  - Para partidos no `finished`, `pointsEarned` es `null` (todavía
 *    sin calcular). Para finished con `point_events`, suma todo
 *    (incluye combos). Para finished sin `point_events` (caso raro de
 *    pre-scoring) es 0.
 */
export async function getPredictionHistory(
  db: Database,
  userId: string,
  options: { limit?: number; outcome?: HistoryOutcomeFilter } = {},
): Promise<HistoryEntry[]> {
  const { limit = 100, outcome = "all" } = options;
  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");

  // Subselect: suma de point_events del user agrupada por matchId.
  const pointsByMatch = db
    .select({
      matchId: pointEvents.matchId,
      total: sql<number>`sum(${pointEvents.points})::int`.as("total_points"),
    })
    .from(pointEvents)
    .where(eq(pointEvents.userId, userId))
    .groupBy(pointEvents.matchId)
    .as("points_by_match");

  const rows = await db
    .select({
      matchId: matches.id,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeName: homeTeam.name,
      homeFlag: homeTeam.flag,
      homeCode: homeTeam.code,
      awayName: awayTeam.name,
      awayFlag: awayTeam.flag,
      awayCode: awayTeam.code,
      kind: predictions.kind,
      predictedWinner: predictions.predictedWinner,
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
      submittedAt: predictions.submittedAt,
      pointsEarned: pointsByMatch.total,
    })
    .from(predictions)
    .innerJoin(matches, eq(matches.id, predictions.matchId))
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .leftJoin(pointsByMatch, eq(pointsByMatch.matchId, predictions.matchId))
    .where(
      and(
        eq(predictions.userId, userId),
        outcome === "hit"
          ? and(eq(matches.status, "finished"), sql`coalesce(${pointsByMatch.total}, 0) > 0`)
          : outcome === "miss"
            ? and(eq(matches.status, "finished"), sql`coalesce(${pointsByMatch.total}, 0) = 0`)
            : outcome === "pending"
              ? sql`${matches.status} <> 'finished'`
              : undefined,
      ),
    )
    .orderBy(desc(matches.kickoffAt))
    .limit(limit);

  dlog("ranking", "getPredictionHistory", { userId, entries: rows.length });

  return rows.map(
    (row): HistoryEntry => ({
      matchId: row.matchId,
      kickoffAt: row.kickoffAt,
      status: row.status as MatchStatus,
      homeTeam: {
        name: row.homeName ?? "—",
        flag: row.homeFlag,
        code: row.homeCode,
      },
      awayTeam: {
        name: row.awayName ?? "—",
        flag: row.awayFlag,
        code: row.awayCode,
      },
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      prediction: {
        kind: row.kind as PredictionKind,
        predictedWinner: row.predictedWinner as PredictionWinner | null,
        predictedHomeScore: row.predictedHomeScore,
        predictedAwayScore: row.predictedAwayScore,
        submittedAt: row.submittedAt,
      },
      pointsEarned: row.status === "finished" ? (row.pointsEarned ?? 0) : null,
    }),
  );
}
