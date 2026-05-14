import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { matches, predictions } from "@/server/db/schema";
import type { MatchStage } from "@/server/scoring/types";
import {
  isPredictionWindowOpen,
  type PredictionInput,
  validatePrediction,
} from "./rules";

export type SubmitPredictionInput = {
  db: Database;
  userId: string;
  matchId: string;
  prediction: PredictionInput;
  /** Inyectable para tests. */
  now?: Date;
};

export type SubmitPredictionResult =
  | { ok: true; matchId: string }
  | {
      ok: false;
      code:
        | "match_not_found"
        | "match_window_closed"
        | "match_already_started"
        | "kind_not_allowed_for_stage"
        | "simple_missing_winner"
        | "simple_draw_in_knockout"
        | "exact_missing_scores"
        | "exact_negative_scores"
        | "exact_unreasonable_scores"
        | "double_has_winner_or_scores";
    };

/**
 * Sube o actualiza la predicción del usuario para un match.
 *
 * Reglas (en orden de evaluación):
 *  1. El match existe → carga `stage` + `kickoffAt` + `status`.
 *  2. El status del match debe ser `scheduled` o `scheduled-tbd`
 *     (`prediction-locked`/`live`/`finished`/etc. cierran la ventana).
 *  3. `kickoffAt > now()` (defensa adicional por si el cron tarda en
 *     mover el status).
 *  4. Validación pura del `kind` y campos (rules.ts).
 *  5. Upsert: INSERT o UPDATE según el unique `(user_id, match_id)`.
 *
 * Idempotente sobre repeticiones del mismo input. Atomic via SQL
 * (drizzle envuelve cada call en su propia tx implícita).
 */
export async function submitPrediction(
  input: SubmitPredictionInput,
): Promise<SubmitPredictionResult> {
  const { db, userId, matchId, prediction, now } = input;

  const row = await db
    .select({
      stage: matches.stage,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  const match = row[0];
  if (!match) return { ok: false, code: "match_not_found" };

  if (
    match.status !== "scheduled" &&
    match.status !== "scheduled-tbd"
  ) {
    return { ok: false, code: "match_already_started" };
  }

  if (!isPredictionWindowOpen(match.kickoffAt, now)) {
    return { ok: false, code: "match_window_closed" };
  }

  const v = validatePrediction(prediction, match.stage as MatchStage);
  if (!v.ok) return v;

  await db
    .insert(predictions)
    .values({
      userId,
      matchId,
      kind: prediction.kind,
      predictedWinner: prediction.predictedWinner,
      predictedHomeScore: prediction.predictedHomeScore,
      predictedAwayScore: prediction.predictedAwayScore,
    })
    .onConflictDoUpdate({
      target: [predictions.userId, predictions.matchId],
      set: {
        kind: prediction.kind,
        predictedWinner: prediction.predictedWinner,
        predictedHomeScore: prediction.predictedHomeScore,
        predictedAwayScore: prediction.predictedAwayScore,
        submittedAt: sql`now()`,
      },
    });

  return { ok: true, matchId };
}

/**
 * Borra la predicción del usuario para un match. Útil para que el
 * formulario permita "limpiar" antes de re-elegir. Idempotente.
 */
export async function deletePrediction(
  db: Database,
  userId: string,
  matchId: string,
): Promise<void> {
  await db
    .delete(predictions)
    .where(
      and(eq(predictions.userId, userId), eq(predictions.matchId, matchId)),
    );
}
