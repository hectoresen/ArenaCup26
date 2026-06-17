import type { PredictionView, TeamView } from "@/server/dashboard/types";
import type { MatchStage, MatchStatus } from "@/server/scoring/types";

export type MatchListItem = {
  matchId: string;
  stage: MatchStage;
  kickoffAt: Date;
  status: MatchStatus;
  homeTeam: TeamView | null;
  awayTeam: TeamView | null;
  homeScore: number | null;
  awayScore: number | null;
  /**
   * Minuto en juego cuando `status` es `live`/`extra_time`/
   * `penalty_shootout`. Null en programados o finalizados.
   * Permite a las cards mostrar "Min 67'" sin más llamadas.
   */
  minute: number | null;
  prediction: PredictionView | null;
};

export type MatchGroup = {
  /** ISO date "YYYY-MM-DD" en UTC del día del kickoff. */
  dayKey: string;
  /** Primer kickoff del grupo, para etiquetar en el header. */
  dayDate: Date;
  matches: MatchListItem[];
};

export type MatchDetail = MatchListItem & {
  /** Suma cumulativa al final de la prórroga si aplica. */
  homeScoreExtra: number | null;
  awayScoreExtra: number | null;
  /** UUID del equipo que ganó por penales. `null` si no fue a penales. */
  penaltyWinnerTeamId: string | null;
  /**
   * Puntos provisionales si el partido acabara con el marcador actual.
   * Solo tiene valor cuando `status === 'live'`, hay marcador y hay
   * predicción del viewer. Mismo shape que en `LiveMatchView` del
   * dashboard — comparten el bloque de predicción en vivo.
   */
  provisional: {
    points: number;
    kind: "simple" | "exact" | "double" | "miss" | "voided";
  } | null;
};

/**
 * Ronda eliminatoria del bracket. Reusamos los valores del enum
 * `match_stage` salvo `group`/`regular-season` que no entran en el
 * bracket. El orden de las claves marca el orden visual en la vista.
 */
export type BracketRound =
  | "round-of-32"
  | "round-of-16"
  | "quarter"
  | "semi"
  | "third-place"
  | "final";

export type BracketRoundGroup = {
  round: BracketRound;
  matches: MatchListItem[];
};

export type BracketData = {
  rounds: BracketRoundGroup[];
};

/**
 * Filtros aplicables a la vista "Todos" de `/partidos`. Cada uno
 * tiene un valor `"all"` que lo desactiva — la combinación de los 3
 * en `"all"`/`false` es equivalente a la query sin filtros.
 */
export type MatchesFilters = {
  status: "all" | "live" | "scheduled" | "finished";
  stage: "all" | "group" | "knockout";
  /** Si `true`, solo partidos donde el user ya envió predicción. */
  predictedOnly: boolean;
};

export const DEFAULT_MATCHES_FILTERS: MatchesFilters = {
  status: "all",
  stage: "all",
  predictedOnly: false,
};
