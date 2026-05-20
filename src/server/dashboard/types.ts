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
  /**
   * Posición global. **Siempre** un número — incluso los usuarios
   * sin puntos forman parte del ranking (su rank queda al final,
   * empatados a 0 con tie-break por createdAt asc).
   */
  rank: number;
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
  /**
   * Puntos provisionales si el partido acabara con el marcador
   * actual. `null` cuando no hay predicción o el engine no puede
   * inferir nada. Calculado al vuelo, NO persistido.
   */
  provisional: {
    points: number;
    kind: "simple" | "exact" | "double" | "miss" | "voided";
  } | null;
};

export type UpcomingHeroView = {
  matchId: string;
  stage: MatchStage;
  kickoffAt: Date;
  homeTeam: TeamView;
  awayTeam: TeamView;
  prediction: PredictionView | null;
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
  rank: number;
  /** Cambio respecto a hace 24h. `null` mientras no tengamos histórico. */
  rankDelta: number | null;
  /**
   * Rank de hace ~24h (snapshot del día anterior). Se propaga al
   * cliente para que `LiveRankBody` pueda recalcular el delta cuando
   * llega un nuevo rank vía SSE. `null` si no hay snapshot anterior.
   */
  dayAgoRank: number | null;
  /** Serie de posiciones para la sparkline (7 días). `null` mientras no tengamos histórico. */
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
  /**
   * Username público del user. Si está set, la fila del
   * mini-leaderboard es clickable a `/u/<username>`. Si es null
   * (caso raro post-backfill), la fila no enlaza.
   */
  username: string | null;
  /** ISO 3166-1 alpha-2 ("ES", "MX"…). Para renderizar con
   *  `<CountryFlag code={...} />`. Null si el user no tiene país. */
  countryCode: string | null;
  points: number;
  rank: number;
};

export type MiniLeaderboardView = {
  top: LeaderboardEntry[];
  /** Fila del usuario actual. `null` si está en el top (no duplicar). */
  me: LeaderboardEntry | null;
};

/**
 * Vista "Top entre amigos" del widget de mini-leaderboard. Mismo
 * shape que el global pero las filas vienen filtradas a `userId IN
 * (mis amigos aceptados + yo)`. El `me` sigue siendo null cuando ya
 * estoy en el top.
 *
 * `friendsCount` es el counter total (puede ser >5 — el top está
 * limitado a 5 filas pero el badge "n amigos" usa el counter).
 */
export type FriendsMiniLeaderboardView = MiniLeaderboardView & {
  friendsCount: number;
};

export type MiniLeaderboardData = {
  global: MiniLeaderboardView;
  friends: FriendsMiniLeaderboardView;
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
  mini: MiniLeaderboardData;
  /**
   * Cooldown restante (ms) del último cambio de nombre. Forwardeado
   * al `EditableName` del saludo. 0 si no hay cooldown activo.
   */
  nameCooldownRemainingMs: number;
};
