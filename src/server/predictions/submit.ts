import { dlog } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import { matches, predictions, teams } from "@/server/db/schema";
import { createNotification } from "@/server/notifications/create";
import type { MatchStage } from "@/server/scoring/types";
import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type PredictionInput, isPredictionWindowOpen, validatePrediction } from "./rules";

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
  dlog("predict", "submit attempt", {
    userId,
    matchId,
    kind: prediction.kind,
    winner: prediction.predictedWinner,
    score:
      prediction.predictedHomeScore !== null
        ? `${prediction.predictedHomeScore}-${prediction.predictedAwayScore}`
        : null,
  });

  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");
  const row = await db
    .select({
      stage: matches.stage,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
    })
    .from(matches)
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(eq(matches.id, matchId))
    .limit(1);

  const match = row[0];
  if (!match) {
    dlog("predict", "match_not_found", { matchId });
    return { ok: false, code: "match_not_found" };
  }

  if (match.status !== "scheduled" && match.status !== "scheduled-tbd") {
    dlog("predict", "match_already_started", { matchId, status: match.status });
    return { ok: false, code: "match_already_started" };
  }

  if (!isPredictionWindowOpen(match.kickoffAt, now)) {
    dlog("predict", "match_window_closed", {
      matchId,
      kickoffAt: match.kickoffAt.toISOString(),
    });
    return { ok: false, code: "match_window_closed" };
  }

  const v = validatePrediction(prediction, match.stage as MatchStage);
  if (!v.ok) {
    dlog("predict", "validation failed", { code: v.code });
    return v;
  }

  // Detectamos si es submit nuevo o edición para no spamear notis al
  // editar repetidamente.
  const existing = await db
    .select({ id: predictions.id })
    .from(predictions)
    .where(and(eq(predictions.userId, userId), eq(predictions.matchId, matchId)))
    .limit(1);
  const isNew = existing.length === 0;

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

  // Solo notificar en el primer submit. Editar más tarde no genera
  // una notificación nueva (sería ruido).
  if (isNew) {
    const matchup =
      match.homeName && match.awayName ? `${match.homeName} vs ${match.awayName}` : matchId;
    await createNotification({
      db,
      userId,
      kind: "prediction_sent",
      title: "Predicción enviada",
      body: matchup,
      matchId,
    });
  }

  dlog("predict", "submit ok", { userId, matchId, isNew });
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
    .where(and(eq(predictions.userId, userId), eq(predictions.matchId, matchId)));
}
