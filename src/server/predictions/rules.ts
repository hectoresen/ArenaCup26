import type { PredictionKind, PredictionWinner } from "@/server/dashboard/types";
import { POINTS } from "@/server/scoring/rules";
import type { MatchStage } from "@/server/scoring/types";

export type PredictionInput = {
  kind: PredictionKind;
  predictedWinner: PredictionWinner | null;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
};

/**
 * Puntos base que otorga acertar este tipo de predicción, sin contar
 * combos ni bonus de racha. Pure function.
 */
export function basePointsForKind(kind: PredictionKind): number {
  if (kind === "exact") return POINTS.exact;
  if (kind === "simple") return POINTS.simple;
  return POINTS.double;
}

const KNOCKOUT_STAGES = new Set<MatchStage>([
  "round-of-16",
  "quarter",
  "semi",
  "third-place",
  "final",
]);

/**
 * Qué `kind` de predicción permite cada etapa.
 *
 * - En **fase de grupos**: simple (home/draw/away), exact y las dos
 *   dobles que cubren el empate (1X = local-o-empate, X2 =
 *   empate-o-visitante). NO se permite `double-12` ("gana cualquiera")
 *   — retirada por feedback de UX: no es una predicción significativa
 *   ("casi siempre acierto"). Si llega del cliente, validamos como
 *   `kind_not_allowed_for_stage`. El enum DB la mantiene por
 *   compatibilidad con datos históricos.
 * - En **eliminatoria** (round-of-16+): solo simple `home`/`away` y
 *   `exact`. No hay empate oficial (siempre hay un ganador tras
 *   prórroga o penales), así que ni simple-draw ni dobles tienen
 *   sentido.
 */
export function allowedKindsForStage(stage: MatchStage): readonly PredictionKind[] {
  if (KNOCKOUT_STAGES.has(stage)) {
    return ["simple", "exact"] as const;
  }
  return ["simple", "exact", "double-1x", "double-x2"] as const;
}

export type PredictionValidationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "kind_not_allowed_for_stage"
        | "simple_missing_winner"
        | "simple_draw_in_knockout"
        | "exact_missing_scores"
        | "exact_negative_scores"
        | "exact_unreasonable_scores"
        | "double_has_winner_or_scores";
    };

/** Score máximo razonable para acertar exacto (sanidad). */
const MAX_REASONABLE_SCORE = 20;

/**
 * Valida una predicción contra una etapa de match. Pure function.
 * No comprueba lockout (eso es responsabilidad del caller con la BD).
 */
export function validatePrediction(
  input: PredictionInput,
  stage: MatchStage,
): PredictionValidationResult {
  const allowed = allowedKindsForStage(stage);
  if (!allowed.includes(input.kind)) {
    return { ok: false, code: "kind_not_allowed_for_stage" };
  }

  switch (input.kind) {
    case "simple": {
      if (!input.predictedWinner) {
        return { ok: false, code: "simple_missing_winner" };
      }
      if (input.predictedWinner === "draw" && KNOCKOUT_STAGES.has(stage)) {
        return { ok: false, code: "simple_draw_in_knockout" };
      }
      return { ok: true };
    }
    case "exact": {
      const h = input.predictedHomeScore;
      const a = input.predictedAwayScore;
      if (h === null || a === null) {
        return { ok: false, code: "exact_missing_scores" };
      }
      if (h < 0 || a < 0) {
        return { ok: false, code: "exact_negative_scores" };
      }
      if (h > MAX_REASONABLE_SCORE || a > MAX_REASONABLE_SCORE) {
        return { ok: false, code: "exact_unreasonable_scores" };
      }
      return { ok: true };
    }
    case "double-1x":
    case "double-x2":
    case "double-12": {
      // Dobles no llevan winner ni scores; la etiqueta del kind ya define la cobertura.
      if (
        input.predictedWinner !== null ||
        input.predictedHomeScore !== null ||
        input.predictedAwayScore !== null
      ) {
        return { ok: false, code: "double_has_winner_or_scores" };
      }
      return { ok: true };
    }
  }
}

/**
 * `true` si el partido todavía admite predicciones (no se ha
 * bloqueado por kickoff). Pure function — el caller le pasa el
 * `kickoffAt` de la fila.
 */
export function isPredictionWindowOpen(kickoffAt: Date, now: Date = new Date()): boolean {
  return now.getTime() < kickoffAt.getTime();
}
