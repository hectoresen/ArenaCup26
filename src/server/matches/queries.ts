import type { PredictionView, TeamView } from "@/server/dashboard/types";
import type { Database } from "@/server/db/client";
import { matches, predictions, teams } from "@/server/db/schema";
import type { MatchStage, MatchStatus } from "@/server/scoring/types";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { BracketData, BracketRound, MatchDetail, MatchListItem } from "./types";

const BRACKET_ROUNDS: BracketRound[] = [
  "round-of-16",
  "quarter",
  "semi",
  "third-place",
  "final",
];

function teamView(row: {
  name: string | null;
  code: string | null;
  flag: string | null;
}): TeamView | null {
  if (!row.name || !row.code) return null;
  return { name: row.name, code: row.code, flag: row.flag };
}

async function fetchPredictionMap(
  db: Database,
  userId: string,
  matchIds: string[],
): Promise<Map<string, PredictionView>> {
  if (matchIds.length === 0) return new Map();
  const rows = await db
    .select({
      matchId: predictions.matchId,
      kind: predictions.kind,
      predictedWinner: predictions.predictedWinner,
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
    })
    .from(predictions)
    .where(and(eq(predictions.userId, userId), inArray(predictions.matchId, matchIds)));
  return new Map(
    rows.map((r) => [
      r.matchId,
      {
        kind: r.kind,
        predictedWinner: r.predictedWinner,
        predictedHomeScore: r.predictedHomeScore,
        predictedAwayScore: r.predictedAwayScore,
      },
    ]),
  );
}

/**
 * Lista completa de partidos (todos los status) ordenados por
 * `kickoffAt` ASC. Para una BD con cientos de partidos esto debería
 * paginarse, pero hoy (24 partidos del seed) basta así.
 */
export async function getAllMatches(db: Database, userId: string): Promise<MatchListItem[]> {
  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");
  const rows = await db
    .select({
      id: matches.id,
      stage: matches.stage,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeTeamName: homeTeam.name,
      homeTeamCode: homeTeam.code,
      homeTeamFlag: homeTeam.flag,
      awayTeamName: awayTeam.name,
      awayTeamCode: awayTeam.code,
      awayTeamFlag: awayTeam.flag,
    })
    .from(matches)
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .orderBy(asc(matches.kickoffAt));

  if (rows.length === 0) return [];
  const predictionMap = await fetchPredictionMap(
    db,
    userId,
    rows.map((r) => r.id),
  );

  return rows.map((row) => ({
    matchId: row.id,
    stage: row.stage as MatchStage,
    kickoffAt: row.kickoffAt,
    status: row.status as MatchStatus,
    homeTeam: teamView({
      name: row.homeTeamName,
      code: row.homeTeamCode,
      flag: row.homeTeamFlag,
    }),
    awayTeam: teamView({
      name: row.awayTeamName,
      code: row.awayTeamCode,
      flag: row.awayTeamFlag,
    }),
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    prediction: predictionMap.get(row.id) ?? null,
  }));
}

/**
 * Detalle completo de un partido por id. Devuelve `null` si no existe.
 */
export async function getMatchById(
  db: Database,
  matchId: string,
  userId: string,
): Promise<MatchDetail | null> {
  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");
  const rows = await db
    .select({
      id: matches.id,
      stage: matches.stage,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeScoreExtra: matches.homeScoreExtra,
      awayScoreExtra: matches.awayScoreExtra,
      penaltyWinnerTeamId: matches.penaltyWinnerTeamId,
      homeTeamName: homeTeam.name,
      homeTeamCode: homeTeam.code,
      homeTeamFlag: homeTeam.flag,
      awayTeamName: awayTeam.name,
      awayTeamCode: awayTeam.code,
      awayTeamFlag: awayTeam.flag,
    })
    .from(matches)
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(eq(matches.id, matchId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const predictionMap = await fetchPredictionMap(db, userId, [row.id]);

  return {
    matchId: row.id,
    stage: row.stage as MatchStage,
    kickoffAt: row.kickoffAt,
    status: row.status as MatchStatus,
    homeTeam: teamView({
      name: row.homeTeamName,
      code: row.homeTeamCode,
      flag: row.homeTeamFlag,
    }),
    awayTeam: teamView({
      name: row.awayTeamName,
      code: row.awayTeamCode,
      flag: row.awayTeamFlag,
    }),
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    homeScoreExtra: row.homeScoreExtra,
    awayScoreExtra: row.awayScoreExtra,
    penaltyWinnerTeamId: row.penaltyWinnerTeamId,
    prediction: predictionMap.get(row.id) ?? null,
  };
}

/**
 * Carga los partidos de eliminatoria agrupados por ronda para la
 * vista Bracket de `/partidos`. Las rondas siempre se devuelven en
 * el orden `R16 → QF → SF → 3º → Final`, incluso si todavía no hay
 * partidos en alguna de ellas (la vista renderiza placeholders).
 */
export async function getBracketMatches(db: Database, userId: string): Promise<BracketData> {
  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");
  const rows = await db
    .select({
      id: matches.id,
      stage: matches.stage,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeTeamName: homeTeam.name,
      homeTeamCode: homeTeam.code,
      homeTeamFlag: homeTeam.flag,
      awayTeamName: awayTeam.name,
      awayTeamCode: awayTeam.code,
      awayTeamFlag: awayTeam.flag,
    })
    .from(matches)
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(inArray(matches.stage, BRACKET_ROUNDS))
    .orderBy(asc(matches.kickoffAt));

  const predictionMap =
    rows.length === 0
      ? new Map()
      : await fetchPredictionMap(
          db,
          userId,
          rows.map((r) => r.id),
        );

  const byRound = new Map<BracketRound, MatchListItem[]>();
  for (const round of BRACKET_ROUNDS) byRound.set(round, []);

  for (const row of rows) {
    const item: MatchListItem = {
      matchId: row.id,
      stage: row.stage as MatchStage,
      kickoffAt: row.kickoffAt,
      status: row.status as MatchStatus,
      homeTeam: teamView({
        name: row.homeTeamName,
        code: row.homeTeamCode,
        flag: row.homeTeamFlag,
      }),
      awayTeam: teamView({
        name: row.awayTeamName,
        code: row.awayTeamCode,
        flag: row.awayTeamFlag,
      }),
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      prediction: predictionMap.get(row.id) ?? null,
    };
    byRound.get(row.stage as BracketRound)?.push(item);
  }

  return {
    rounds: BRACKET_ROUNDS.map((round) => ({
      round,
      matches: byRound.get(round) ?? [],
    })),
  };
}

// Para que el dropdown de notificaciones y otras vistas pueden contar
// "cuántos partidos vivos hay en este momento" sin volver a hacer la
// query completa.
export async function countLiveMatches(db: Database): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(eq(matches.status, "live"));
  return rows[0]?.count ?? 0;
}
