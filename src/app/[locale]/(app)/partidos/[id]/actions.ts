"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import type { PredictionKind, PredictionWinner } from "@/server/dashboard/types";
import {
  deletePrediction,
  submitPrediction,
  type SubmitPredictionResult,
} from "@/server/predictions/submit";

type SubmitArgs = {
  matchId: string;
  kind: PredictionKind;
  predictedWinner: PredictionWinner | null;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
};

/**
 * Server action invocada desde el formulario de predicción.
 * Devuelve un `SubmitPredictionResult` que el cliente usa para
 * mostrar feedback (toast / inline error).
 */
export async function submitPredictionAction(
  args: SubmitArgs,
): Promise<SubmitPredictionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, code: "match_not_found" };
  }

  const result = await submitPrediction({
    db,
    userId: session.user.id,
    matchId: args.matchId,
    prediction: {
      kind: args.kind,
      predictedWinner: args.predictedWinner,
      predictedHomeScore: args.predictedHomeScore,
      predictedAwayScore: args.predictedAwayScore,
    },
  });

  if (result.ok) {
    // Refresca el detalle (badge "Predicción enviada") y la home
    // (lista de próximos partidos también muestra el estado).
    revalidatePath(`/partidos/${args.matchId}`);
    revalidatePath("/inicio");
  }

  return result;
}

export async function deletePredictionAction(matchId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await deletePrediction(db, session.user.id, matchId);
  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/inicio");
}
