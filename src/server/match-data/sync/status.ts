import type { ProviderMatchStatus } from "../types";
import type { DbMatchStatus } from "./types";

/**
 * Colapsa el `ProviderMatchStatus` (10 valores) al enum `match_status`
 * de la BD (7 valores). Pure function.
 *
 * - extra_time / penalty_shootout / interrupted → live (la BD no
 *   distingue entre fases del live; el scoring engine sí, pero opera
 *   sobre `MatchOutcome` reconstruido de los scores).
 * - abandoned → cancelled (ver decisión cerrada en el proposal del
 *   round a; `business-rules.md` no define hoy un tratamiento
 *   diferenciado).
 * - unknown → scheduled (no perdemos el partido en una zona sin enum
 *   válido; el cron lo volverá a tocar).
 *
 * Los estados internos de la app `scheduled-tbd` y `prediction-locked`
 * no son producibles desde un provider; el reconciler los preserva en
 * la fila actual aparte.
 */
export function providerToDbStatus(status: ProviderMatchStatus): DbMatchStatus {
  switch (status) {
    case "scheduled":
      return "scheduled";
    case "live":
    case "extra_time":
    case "penalty_shootout":
    case "interrupted":
      return "live";
    case "finished":
      return "finished";
    case "postponed":
      return "postponed";
    case "cancelled":
    case "abandoned":
      return "cancelled";
    case "unknown":
      return "scheduled";
  }
}
