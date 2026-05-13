import type { MatchStage } from "@/server/scoring/types";

export type PredictionKind = "simple" | "exact" | "double-1x" | "double-x2" | "double-12";
export type PredictionWinner = "home" | "away" | "draw";

export type TeamView = {
  /** Nombre canónico (e.g. "Argentina"). */
  name: string;
  /** Bandera Unicode si se tiene; null para fixtures TBD. */
  flag: string | null;
  /** Código FIFA si está disponible. */
  code: string | null;
};

export type PredictionView = {
  kind: PredictionKind;
  predictedWinner: PredictionWinner | null;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
};

export type UserStats = {
  totalPoints: number;
  streak: number;
  correctCount: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  /** Posición global o `null` si el usuario aún no tiene puntos. */
  rank: number | null;
  totalPlayers: number;
};

export type LiveMatchView = {
  matchId: string;
  stage: MatchStage;
  homeTeam: TeamView;
  awayTeam: TeamView;
  /** Marcador en el momento del snapshot. */
  homeScore: number;
  awayScore: number;
  /** Minuto en curso si el provider lo entrega; null si solo sabemos que está live. */
  minute: number | null;
  prediction: PredictionView | null;
};

export type UpcomingHeroView = {
  matchId: string;
  stage: MatchStage;
  kickoffAt: Date;
  homeTeam: TeamView;
  awayTeam: TeamView;
};

export type UpcomingMatch = {
  matchId: string;
  stage: MatchStage;
  kickoffAt: Date;
  /** `null` cuando el partido está pendiente de bracket (semifinal sin equipos). */
  homeTeam: TeamView | null;
  awayTeam: TeamView | null;
  prediction: PredictionView | null;
};

export type RankProgress = {
  rank: number | null;
  /** Cambio respecto a la semana pasada. `null` mientras no tengamos histórico. */
  rankDelta: number | null;
  /** Serie de posiciones para la sparkline. `null` mientras no tengamos histórico. */
  sparkline: number[] | null;
};

export type AchievementsProgress = {
  unlocked: number;
  total: number;
  lastUnlockedTitle: string | null;
  lastUnlockedAt: Date | null;
};

export type Progress = {
  rank: RankProgress;
  achievements: AchievementsProgress;
};

export type LeaderboardEntry = {
  userId: string;
  name: string;
  flag: string | null;
  points: number;
  rank: number;
};

export type MiniLeaderboardView = {
  top: LeaderboardEntry[];
  /** Fila del usuario actual. `null` si está en el top (no duplicar). */
  me: LeaderboardEntry | null;
};

export type DashboardData = {
  userName: string;
  stats: UserStats;
  /** Si hay partido en vivo, este viene poblado y `nextMatch` queda `null`. */
  live: LiveMatchView | null;
  /** Solo se rellena cuando `live === null` y hay un próximo kickoff. */
  nextMatch: UpcomingHeroView | null;
  upcoming: UpcomingMatch[];
  progress: Progress;
  mini: MiniLeaderboardView;
};
