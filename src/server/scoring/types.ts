import type { ComboMilestone } from "./rules";

export type MatchStage = "group" | "round-of-16" | "quarter" | "semi" | "final" | "third-place";

export type MatchStatus =
  | "scheduled-tbd"
  | "scheduled"
  | "prediction-locked"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type Side = "home" | "away";

/**
 * Snapshot del resultado oficial de un partido tal y como lo necesita el
 * scoring engine. No incluye IDs, equipos ni timestamps; solo los datos
 * estrictamente requeridos para puntuar.
 *
 * - `scoreAt90`: marcador al final del 90' regular. Null en partidos que
 *   no han terminado o se han cancelado.
 * - `scoreAtExtra`: marcador al final de la prórroga (120'). Solo aplica
 *   en eliminatoria que llegó a prórroga; null en cualquier otro caso.
 *   Cuando está presente, el motor lo usa como "marcador oficial" en
 *   sustitución del 90' (regla de eliminatoria de `docs/business-rules.md`).
 * - `penaltyWinner`: ganador por penaltis cuando el partido se decide en
 *   tanda. No suma goles al marcador.
 */
export type MatchOutcome = {
  status: MatchStatus;
  stage: MatchStage;
  scoreAt90: { home: number; away: number } | null;
  scoreAtExtra: { home: number; away: number } | null;
  penaltyWinner: Side | null;
};

export type PredictionKind = "simple" | "exact" | "double-1x" | "double-x2" | "double-12";

export type PredictionWinner = "home" | "away" | "draw";

export type Prediction = {
  kind: PredictionKind;
  /** Solo válido para `kind = "simple"`. */
  predictedWinner: PredictionWinner | null;
  /** Solo válido para `kind = "exact"`. */
  predictedHomeScore: number | null;
  /** Solo válido para `kind = "exact"`. */
  predictedAwayScore: number | null;
};

/**
 * Estado de la racha del usuario ANTES de procesar la predicción actual.
 * El engine devuelve el estado DESPUÉS en `ScoreResult.streakAfter`.
 */
export type StreakState = {
  current: number;
  containsDouble: boolean;
};

export type PointEventKind = "miss" | "simple" | "exact" | "double" | "voided";

export type ComboBonus = {
  milestone: ComboMilestone;
  points: number;
};

export type ScoreResult = {
  /** Total a sumar al usuario, incluye bonus de combo. */
  points: number;
  /**
   * Tipo del evento principal del hit (o `miss` si falló, `voided` si el
   * partido fue anulado/pospuesto).
   */
  kind: PointEventKind;
  streakAfter: StreakState;
  /** Combos disparados en esta predicción (puede ser vacío). */
  comboBonuses: ComboBonus[];
};
