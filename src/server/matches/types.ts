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
};
