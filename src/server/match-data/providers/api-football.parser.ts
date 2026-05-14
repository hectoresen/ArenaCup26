import type { MatchStage } from "@/server/scoring/types";
import type { ProviderMatch, ProviderMatchStatus } from "../types";

/**
 * Shape del fixture tal como lo devuelve api-football
 * (https://www.api-football.com/documentation-v3#operation/get-fixtures).
 *
 * Solo modelamos los campos que consumimos. El resto (referee, venue,
 * periods, timezone, etc.) los ignoramos.
 */
export type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: { long: string; short: ApiFootballStatusCode; elapsed: number | null };
  };
  league: {
    id: number;
    name: string;
    season: number;
    round: string | null;
  };
  teams: {
    home: ApiFootballTeam;
    away: ApiFootballTeam;
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
};

export type ApiFootballTeam = {
  id: number;
  name: string;
  logo: string | null;
  winner: boolean | null;
};

export type ApiFootballStatusCode =
  | "TBD"
  | "NS"
  | "1H"
  | "HT"
  | "2H"
  | "ET"
  | "BT"
  | "P"
  | "SUSP"
  | "INT"
  | "FT"
  | "AET"
  | "PEN"
  | "PST"
  | "CANC"
  | "ABD"
  | "AWD"
  | "WO"
  | "LIVE";

const STATUS_MAP: Record<ApiFootballStatusCode, ProviderMatchStatus> = {
  TBD: "scheduled",
  NS: "scheduled",
  "1H": "live",
  HT: "live",
  "2H": "live",
  LIVE: "live",
  ET: "extra_time",
  BT: "extra_time",
  P: "penalty_shootout",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  PST: "postponed",
  CANC: "cancelled",
  ABD: "abandoned",
  AWD: "abandoned",
  WO: "abandoned",
  SUSP: "interrupted",
  INT: "interrupted",
};

/**
 * Mapea la etiqueta de ronda (string libre) a `MatchStage`.
 * api-football usa convenciones consistentes:
 *   - "Group A - 1", "Group F - 3" → group
 *   - "Round of 16" → round-of-16
 *   - "Quarter-finals" → quarter
 *   - "Semi-finals" → semi
 *   - "3rd Place Final" → third-place
 *   - "Final" → final
 */
export function parseStage(round: string | null | undefined): MatchStage | null {
  if (!round) return null;
  const lower = round.toLowerCase().trim();
  if (lower.startsWith("group")) return "group";
  if (lower.includes("round of 16") || lower.includes("1/8")) return "round-of-16";
  if (lower.includes("quarter")) return "quarter";
  if (lower.includes("semi")) return "semi";
  if (lower.includes("3rd place") || lower.includes("third place") || lower.includes("third-place"))
    return "third-place";
  if (lower === "final" || lower.endsWith("- final") || lower.endsWith(" final")) return "final";
  return null;
}

/**
 * Convierte un fixture nativo de api-football en nuestro shape
 * `ProviderMatch`. Pure function, no I/O.
 */
export function parseApiFootballFixture(
  raw: ApiFootballFixture,
  fetchedAt: Date = new Date(),
): ProviderMatch {
  const status = STATUS_MAP[raw.fixture.status.short] ?? "unknown";
  const scoreAt90 = extractScoreAt90(raw, status);
  const scoreAtExtra = extractScoreAtExtra(raw);
  const penaltyWinner = extractPenaltyWinner(raw);

  return {
    externalId: String(raw.fixture.id),
    source: "api-football",
    externalLeagueId: raw.league.id,
    externalSeason: raw.league.season,
    roundLabel: raw.league.round,
    stage: parseStage(raw.league.round),
    homeTeam: {
      externalId: String(raw.teams.home.id),
      name: raw.teams.home.name,
      code: null, // api-football no entrega códigos FIFA directos
      logo: raw.teams.home.logo,
    },
    awayTeam: {
      externalId: String(raw.teams.away.id),
      name: raw.teams.away.name,
      code: null,
      logo: raw.teams.away.logo,
    },
    kickoffAt: new Date(raw.fixture.date),
    status,
    scoreAt90,
    scoreAtExtra,
    penaltyWinner,
    fetchedAt,
  };
}

/**
 * `score.fulltime` = marcador al final del 90' regular. Solo lo
 * consideramos válido cuando el partido ha terminado al menos esa fase.
 */
function extractScoreAt90(
  raw: ApiFootballFixture,
  status: ProviderMatchStatus,
): { home: number; away: number } | null {
  if (status === "scheduled" || status === "cancelled" || status === "postponed") {
    return null;
  }
  const ft = raw.score.fulltime;
  if (ft.home === null || ft.away === null) return null;
  return { home: ft.home, away: ft.away };
}

/**
 * **Importante**: api-football reporta `score.extratime` con los goles
 * marcados SOLO durante la prórroga (no acumulado). El marcador
 * acumulado al final del 120' es:
 *   `score.fulltime + score.extratime`  ó  `goals` (mismo valor).
 *
 * Devolvemos null si no hubo prórroga (extratime con ambos lados null).
 */
function extractScoreAtExtra(raw: ApiFootballFixture): { home: number; away: number } | null {
  const et = raw.score.extratime;
  if (et.home === null || et.away === null) return null;
  // Hay prórroga: el marcador acumulado coincide con `goals` (que api-football
  // reporta como el marcador final del partido sin contar penaltis).
  if (raw.goals.home === null || raw.goals.away === null) {
    // Defensa: si la API no rellenó goals, sumamos manualmente.
    const ft = raw.score.fulltime;
    if (ft.home === null || ft.away === null) return null;
    return { home: ft.home + et.home, away: ft.away + et.away };
  }
  return { home: raw.goals.home, away: raw.goals.away };
}

function extractPenaltyWinner(raw: ApiFootballFixture): "home" | "away" | null {
  const pen = raw.score.penalty;
  if (pen.home === null || pen.away === null) return null;
  if (pen.home > pen.away) return "home";
  if (pen.away > pen.home) return "away";
  return null; // empate en penaltis no debería existir; defensa
}
