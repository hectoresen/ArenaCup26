import type { PredictionView, TeamView } from "@/server/dashboard/types";
import type { Database } from "@/server/db/client";
import { matches, predictions, teams } from "@/server/db/schema";
import type { MatchStage, MatchStatus } from "@/server/scoring/types";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  BracketData,
  BracketRound,
  MatchDetail,
  MatchListItem,
  MatchesFilters,
} from "./types";

const BRACKET_ROUNDS: BracketRound[] = [
  "round-of-16",
  "quarter",
  "semi",
  "third-place",
  "final",
];

/**
 * Status "scheduled" en la UI agrupa los 3 estados que comparten
 * semántica "partido futuro, todavía no jugado":
 *  - `scheduled`: kickoff conocido + equipos resueltos.
 *  - `scheduled-tbd`: kickoff conocido, equipos sin resolver (semi
 *    pre-bracket).
 *  - `prediction-locked`: ventana de predicción cerrada pero partido
 *    aún no empezado.
 */
const SCHEDULED_STATUSES: MatchStatus[] = ["scheduled", "scheduled-tbd", "prediction-locked"];

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
 * Lista filtrable de partidos. Aplica filtros en SQL (no en memoria).
 * Si los 3 filtros están "off" equivale a `getAllMatches`.
 *
 *  - `status: "live"` → solo `status = 'live'`.
 *  - `status: "scheduled"` → 3 valores agrupados (scheduled, tbd,
 *    prediction-locked) — ver `SCHEDULED_STATUSES`.
 *  - `status: "finished"` → solo `status = 'finished'`.
 *  - `stage: "group"` → solo fase de grupos.
 *  - `stage: "knockout"` → R16 + QF + SF + 3rd + Final.
 *  - `predictedOnly: true` → INNER JOIN con `predictions` del user.
 */
export async function getFilteredMatches(
  db: Database,
  userId: string,
  filters: MatchesFilters,
): Promise<MatchListItem[]> {
  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");

  const whereConds: ReturnType<typeof eq>[] = [];

  if (filters.status === "live") {
    whereConds.push(eq(matches.status, "live"));
  } else if (filters.status === "scheduled") {
    whereConds.push(inArray(matches.status, SCHEDULED_STATUSES));
  } else if (filters.status === "finished") {
    whereConds.push(eq(matches.status, "finished"));
  }

  if (filters.stage === "group") {
    whereConds.push(eq(matches.stage, "group"));
  } else if (filters.stage === "knockout") {
    whereConds.push(inArray(matches.stage, BRACKET_ROUNDS));
  }

  // predictedOnly se resuelve con un subselect EXISTS para evitar
  // duplicar filas si por alguna razón hubiera ≥2 predicciones por
  // user+match (constraint actual lo impide, pero defensivo).
  if (filters.predictedOnly) {
    whereConds.push(
      sql`EXISTS (
        SELECT 1 FROM ${predictions}
        WHERE ${predictions.matchId} = ${matches.id}
          AND ${predictions.userId} = ${userId}
      )`,
    );
  }

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
    .where(whereConds.length > 0 ? and(...whereConds) : undefined)
    // Orden por relevancia para el user:
    //  1) En curso (`live`) arriba del todo.
    //  2) Próximos (`kickoffAt >= now`) ascendente — el más cercano
    //     en el tiempo primero, para que sea fácil ir a predecir.
    //  3) Pasados/`finished` al final, descendente — el más reciente
    //     primero, en lugar de tener WC2022 abriendo la página.
    // Si el user aplica filtro de status, este orden interno respeta
    // la semántica (e.g. `?status=finished` ya solo trae pasados → el
    // CASE colapsa a un solo bucket y queda `kickoffAt desc`).
    .orderBy(
      sql`CASE
        WHEN ${matches.status} = 'live' THEN 0
        WHEN ${matches.kickoffAt} >= NOW() THEN 1
        ELSE 2
      END`,
      sql`CASE
        WHEN ${matches.status} = 'live' OR ${matches.kickoffAt} >= NOW()
          THEN ${matches.kickoffAt}
      END ASC NULLS LAST`,
      sql`${matches.kickoffAt} DESC`,
    )
    // Tope generoso para evitar payloads enormes con calendarios
    // grandes (Mundial 104 + ligas activas). El user puede filtrar
    // por status/stage/predictedOnly para acotar. 250 cubre cualquier
    // visión razonable; paginación se introduce si la cifra crece.
    .limit(250);

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
