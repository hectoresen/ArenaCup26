import type { MatchStatus, PredictionKind, PredictionWinner } from "@/server/scoring/types";

/**
 * Una entrada del historial: predicción del user + estado actual del
 * partido + puntos ganados (si ya terminó). Pensada para mostrarla en
 * `/historial` con una card por entry.
 */
export type HistoryEntry = {
  matchId: string;
  kickoffAt: Date;
  status: MatchStatus;
  homeTeam: {
    name: string;
    flag: string | null;
    code: string | null;
  };
  awayTeam: {
    name: string;
    flag: string | null;
    code: string | null;
  };
  /**
   * Marcador "oficial" para mostrar. `null` cuando el match aún no
   * tiene marcador (scheduled/scheduled-tbd/postponed/cancelled).
   */
  homeScore: number | null;
  awayScore: number | null;
  prediction: {
    kind: PredictionKind;
    predictedWinner: PredictionWinner | null;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
    submittedAt: Date;
  };
  /**
   * Suma de puntos ganados con esta predicción (incluye combos).
   * - `0` si el partido terminó y el user falló.
   * - `null` si el partido aún no ha terminado.
   * - `> 0` si acertó (con o sin combos).
   */
  pointsEarned: number | null;
};
