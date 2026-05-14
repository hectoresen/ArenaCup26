export type Player = {
  id: string;
  /**
   * Slug del usuario para construir el link a `/u/<username>`. `null`
   * si el row es legacy y no tiene username (no debería pasar — todos
   * los usuarios reales hacen el backfill de username en signup).
   */
  username: string | null;
  name: string;
  countryCode: string;
  countryName: string;
  flag: string;
  points: number;
  streak: number;
  correctCount: number;
  rank: number;
  previousRank: number;
};

export type LeaderboardSnapshot = {
  generatedAt: string;
  players: Player[];
};

export type LeaderboardEvent =
  | {
      type: "score-update";
      playerId: string;
      pointsDelta: number;
      newRank: number;
    }
  | { type: "snapshot"; snapshot: LeaderboardSnapshot };
