import { COMBO_BONUS, COMBO_MILESTONES, POINTS } from "./rules";
import type {
  ComboBonus,
  MatchOutcome,
  PointEventKind,
  Prediction,
  PredictionWinner,
  ScoreResult,
  StreakState,
} from "./types";

const ZERO_STREAK: StreakState = { current: 0, containsDouble: false };

/**
 * Calcula los puntos derivados de una predicción tras el cierre oficial
 * de un partido. Función pura: no toca BD, no muta inputs, no hace I/O.
 *
 * Orquestada server-side cuando `match.status` pasa a `finished` o cuando
 * se aplica la regla de cancelación. Cada llamada produce un `ScoreResult`
 * que el caller materializa en `point_events` y actualiza `user_points`.
 */
export function scoreMatchPrediction(
  match: MatchOutcome,
  prediction: Prediction,
  streakBefore: StreakState,
): ScoreResult {
  // Cancelado / pospuesto / cualquier estado != finished → voided.
  // La racha se preserva (regla "salta el partido" de business-rules.md).
  if (match.status !== "finished") {
    return {
      points: 0,
      kind: "voided",
      streakAfter: streakBefore,
      comboBonuses: [],
    };
  }

  const outcome = resolveOutcome(match);
  if (!outcome) {
    // Partido marcado como finished pero sin marcadores: trato defensivo.
    // No reseteo racha porque no puedo afirmar que el usuario fallara.
    return {
      points: 0,
      kind: "voided",
      streakAfter: streakBefore,
      comboBonuses: [],
    };
  }

  const hit = evaluateHit(prediction, outcome);
  if (!hit) {
    return {
      points: 0,
      kind: "miss",
      streakAfter: ZERO_STREAK,
      comboBonuses: [],
    };
  }

  const streakAfter: StreakState = {
    current: streakBefore.current + 1,
    containsDouble: streakBefore.containsDouble || hit.isDouble,
  };

  const comboBonuses = computeComboBonuses(
    streakBefore.current,
    streakAfter.current,
    streakAfter.containsDouble,
  );
  const totalCombo = comboBonuses.reduce((acc, b) => acc + b.points, 0);

  return {
    points: hit.basePoints + totalCombo,
    kind: hit.kind,
    streakAfter,
    comboBonuses,
  };
}

/**
 * Resuelve el "marcador oficial" y el "ganador oficial" del partido.
 *
 * - Marcador: el de la prórroga si la hubo (regla de eliminatoria), si no
 *   el del 90'.
 * - Ganador: el equipo con más goles en ese marcador. Si están empatados
 *   y hay `penaltyWinner` (eliminatoria a tanda), gana ese. Si están
 *   empatados sin penaltyWinner, es un empate (solo válido en grupos).
 */
function resolveOutcome(match: MatchOutcome): {
  home: number;
  away: number;
  winner: PredictionWinner;
} | null {
  const score = match.scoreAtExtra ?? match.scoreAt90;
  if (!score) return null;

  let winner: PredictionWinner;
  if (score.home > score.away) winner = "home";
  else if (score.away > score.home) winner = "away";
  else if (match.penaltyWinner) winner = match.penaltyWinner;
  else winner = "draw";

  return { home: score.home, away: score.away, winner };
}

type Hit = { kind: PointEventKind; basePoints: number; isDouble: boolean };

function evaluateHit(
  prediction: Prediction,
  outcome: { home: number; away: number; winner: PredictionWinner },
): Hit | null {
  switch (prediction.kind) {
    case "simple": {
      if (!prediction.predictedWinner) return null;
      if (prediction.predictedWinner === outcome.winner) {
        return { kind: "simple", basePoints: POINTS.simple, isDouble: false };
      }
      return null;
    }
    case "exact": {
      if (
        prediction.predictedHomeScore === null ||
        prediction.predictedAwayScore === null
      ) {
        return null;
      }
      if (
        prediction.predictedHomeScore === outcome.home &&
        prediction.predictedAwayScore === outcome.away
      ) {
        return { kind: "exact", basePoints: POINTS.exact, isDouble: false };
      }
      return null;
    }
    default: {
      const covered = coverageForDouble(prediction.kind);
      if (covered.has(outcome.winner)) {
        return { kind: "double", basePoints: POINTS.double, isDouble: true };
      }
      return null;
    }
  }
}

function coverageForDouble(
  kind: "double-1x" | "double-x2" | "double-12",
): Set<PredictionWinner> {
  switch (kind) {
    case "double-1x":
      return new Set<PredictionWinner>(["home", "draw"]);
    case "double-x2":
      return new Set<PredictionWinner>(["draw", "away"]);
    case "double-12":
      return new Set<PredictionWinner>(["home", "away"]);
  }
}

/**
 * Devuelve los hitos cruzados al pasar de `before` a `after`.
 * Por construcción `after === before + 1`, así que como mucho cruza un
 * hito, pero el código generaliza por seguridad.
 */
function computeComboBonuses(
  before: number,
  after: number,
  containsDouble: boolean,
): ComboBonus[] {
  const table = containsDouble ? COMBO_BONUS.modified : COMBO_BONUS.base;
  const bonuses: ComboBonus[] = [];
  for (const milestone of COMBO_MILESTONES) {
    if (before < milestone && after >= milestone) {
      bonuses.push({ milestone, points: table[milestone] });
    }
  }
  return bonuses;
}
