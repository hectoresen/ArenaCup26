export type Player = {
  id: string;
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
