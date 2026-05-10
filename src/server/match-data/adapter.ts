import type { MatchOutcome, MatchStatus } from "@/server/scoring/types";
import type { ProviderMatch, ProviderMatchStatus } from "./types";

const STATUS_MAP: Record<ProviderMatchStatus, MatchStatus> = {
  scheduled: "scheduled",
  live: "live",
  extra_time: "live",
  penalty_shootout: "live",
  finished: "finished",
  postponed: "postponed",
  cancelled: "cancelled",
  abandoned: "cancelled",
  interrupted: "live",
  unknown: "scheduled",
};

/**
 * Convierte un `ProviderMatch` (snapshot del proveedor) a `MatchOutcome`
 * (input del scoring engine). Pure function, no I/O.
 *
 * - Una vez aquí, el código del scoring engine no sabe (ni necesita saber)
 *   de qué proveedor vino la información.
 * - El campo `stage` debe estar resuelto a un valor de `MatchStage`. Si
 *   el provider no pudo inferirlo, el adapter lanza para forzar al caller
 *   a manejar el caso (típicamente: ignorar el partido, o pedir al provider
 *   que lo siembre con un round identificable).
 */
export function toMatchOutcome(match: ProviderMatch): MatchOutcome {
  if (!match.stage) {
    throw new Error(
      `Cannot adapt match ${match.externalId} from ${match.source}: stage is null (round label was "${match.roundLabel ?? "<empty>"}")`,
    );
  }
  return {
    status: STATUS_MAP[match.status],
    stage: match.stage,
    scoreAt90: match.scoreAt90,
    scoreAtExtra: match.scoreAtExtra,
    penaltyWinner: match.penaltyWinner,
  };
}
