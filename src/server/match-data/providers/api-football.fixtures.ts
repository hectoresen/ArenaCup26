import type { ApiFootballFixture } from "./api-football.parser";

/**
 * Muestras de respuestas de api-football usadas por los tests del parser.
 * Los datos imitan el shape oficial documentado en
 * https://www.api-football.com/documentation-v3#operation/get-fixtures.
 *
 * El fixture `WC2022_FINAL` está modelado a partir del partido real
 * Argentina 3-3 Francia (Argentina ganó 4-2 en penaltis), validado en
 * sandbox 2026-05-10.
 */

export const WC2022_FINAL_RAW: ApiFootballFixture = {
  fixture: {
    id: 979139,
    date: "2022-12-18T15:00:00+00:00",
    timestamp: 1671375600,
    status: { long: "Match Finished", short: "PEN", elapsed: 120 },
  },
  league: {
    id: 1,
    name: "World Cup",
    season: 2022,
    round: "Final",
  },
  teams: {
    home: { id: 26, name: "Argentina", logo: "argentina.png", winner: true },
    away: { id: 2, name: "France", logo: "france.png", winner: false },
  },
  goals: { home: 3, away: 3 },
  score: {
    halftime: { home: 2, away: 0 },
    fulltime: { home: 2, away: 2 },
    // ⚠️ extratime son los goles SOLO del periodo de prórroga
    extratime: { home: 1, away: 1 },
    penalty: { home: 4, away: 2 },
  },
};

/** Final ganada en prórroga sin penaltis (3-2 al 120', no shootout). */
export const KO_EXTRA_TIME_HOME_WIN_RAW: ApiFootballFixture = {
  fixture: {
    id: 1001,
    date: "2026-07-15T19:00:00+00:00",
    timestamp: 1768496400,
    status: { long: "Match Finished After Extra Time", short: "AET", elapsed: 120 },
  },
  league: { id: 1, name: "World Cup", season: 2026, round: "Quarter-finals" },
  teams: {
    home: { id: 100, name: "Spain", logo: null, winner: true },
    away: { id: 101, name: "Italy", logo: null, winner: false },
  },
  goals: { home: 3, away: 2 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: 2, away: 2 },
    extratime: { home: 1, away: 0 },
    penalty: { home: null, away: null },
  },
};

/** Partido decidido en 90' regulares, sin prórroga. */
export const KO_REGULAR_HOME_WIN_RAW: ApiFootballFixture = {
  fixture: {
    id: 1002,
    date: "2026-07-04T15:00:00+00:00",
    timestamp: 1767538800,
    status: { long: "Match Finished", short: "FT", elapsed: 90 },
  },
  league: { id: 1, name: "World Cup", season: 2026, round: "Round of 16" },
  teams: {
    home: { id: 200, name: "Brazil", logo: null, winner: true },
    away: { id: 201, name: "Korea Republic", logo: null, winner: false },
  },
  goals: { home: 4, away: 1 },
  score: {
    halftime: { home: 3, away: 0 },
    fulltime: { home: 4, away: 1 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
};

/** Partido de fase de grupos terminado en empate. */
export const GROUP_DRAW_RAW: ApiFootballFixture = {
  fixture: {
    id: 1003,
    date: "2026-06-22T19:00:00+00:00",
    timestamp: 1782842400,
    status: { long: "Match Finished", short: "FT", elapsed: 90 },
  },
  league: { id: 1, name: "World Cup", season: 2026, round: "Group A - 2" },
  teams: {
    home: { id: 300, name: "Mexico", logo: null, winner: null },
    away: { id: 301, name: "Canada", logo: null, winner: null },
  },
  goals: { home: 1, away: 1 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: 1, away: 1 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
};

/** Partido pospuesto. */
export const POSTPONED_RAW: ApiFootballFixture = {
  fixture: {
    id: 1004,
    date: "2026-06-25T19:00:00+00:00",
    timestamp: 1783101600,
    status: { long: "Match Postponed", short: "PST", elapsed: null },
  },
  league: { id: 1, name: "World Cup", season: 2026, round: "Group B - 3" },
  teams: {
    home: { id: 400, name: "England", logo: null, winner: null },
    away: { id: 401, name: "Iran", logo: null, winner: null },
  },
  goals: { home: null, away: null },
  score: {
    halftime: { home: null, away: null },
    fulltime: { home: null, away: null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
};

/** Partido en vivo en mitad del segundo tiempo. */
export const LIVE_2H_RAW: ApiFootballFixture = {
  fixture: {
    id: 1005,
    date: "2026-06-15T19:00:00+00:00",
    timestamp: 1781986800,
    status: { long: "Second Half", short: "2H", elapsed: 67 },
  },
  league: { id: 1, name: "World Cup", season: 2026, round: "Group C - 1" },
  teams: {
    home: { id: 500, name: "Spain", logo: null, winner: null },
    away: { id: 501, name: "Brazil", logo: null, winner: null },
  },
  goals: { home: 2, away: 1 },
  score: {
    halftime: { home: 1, away: 1 },
    fulltime: { home: null, away: null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
};

/** Partido programado, aún no empezado. */
export const SCHEDULED_RAW: ApiFootballFixture = {
  fixture: {
    id: 1006,
    date: "2026-07-19T19:00:00+00:00",
    timestamp: 1768842000,
    status: { long: "Not Started", short: "NS", elapsed: null },
  },
  league: { id: 1, name: "World Cup", season: 2026, round: "Final" },
  teams: {
    home: { id: 600, name: "TBD", logo: null, winner: null },
    away: { id: 601, name: "TBD", logo: null, winner: null },
  },
  goals: { home: null, away: null },
  score: {
    halftime: { home: null, away: null },
    fulltime: { home: null, away: null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
};
