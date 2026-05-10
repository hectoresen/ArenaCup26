import type { ProviderMatch } from "../types";
import { providerToDbStatus } from "./status";
import type {
  CurrentMatchRow,
  DbMatchStatus,
  MatchInsertRow,
  MatchUpdatePatch,
  ReconcileResult,
  TeamExternalMap,
} from "./types";

type ReconcileInput = {
  current: CurrentMatchRow | null;
  matchId: string | null;
  snapshot: ProviderMatch;
  teamMap: TeamExternalMap;
};

/**
 * Decide qué hacer con un snapshot del provider frente a la fila
 * actual de `matches`. Pure function — la I/O (fetch, write) la hace
 * el orquestador `syncFixtures`.
 *
 * Reglas:
 * - Si `snapshot.stage` es null (round desconocido) → skip.
 * - Si los teams no están mapeados (no existe entry en
 *   `team_external_ids`) → skip con `team_not_mapped`.
 * - Si `current` es null → insert con todas las columnas resueltas.
 * - Si `current` existe → calcular patch:
 *   - status: NUNCA retroceder desde `prediction-locked` hacia
 *     `scheduled`. Cualquier otra transición la dicta el provider.
 *   - scores en regulación (`scoreAt90`) y prórroga (`scoreAtExtra`):
 *     escribir si difieren. Si el snapshot trae `null` (porque el
 *     partido todavía no terminó la fase correspondiente), NO
 *     sobreescribir lo que tengamos en BD (evita borrar marcadores
 *     reales con un null transitorio).
 *   - penaltyWinner: solo se actualiza si el provider entrega valor
 *     concreto (home/away). Un null del provider no borra la fila.
 *   - kickoffAt: si difiere → patch (los partidos pueden
 *     reschedularse).
 * - Si nada cambia → noop (el orquestador no llama UPDATE).
 */
export function reconcileMatch(input: ReconcileInput): ReconcileResult {
  const { current, matchId, snapshot, teamMap } = input;

  if (snapshot.stage === null) {
    return {
      kind: "skip",
      externalId: snapshot.externalId,
      reason: "stage_unresolved",
      detail: snapshot.roundLabel ?? undefined,
    };
  }

  const homeTeamId = teamMap.get(snapshot.homeTeam.externalId);
  if (!homeTeamId) {
    return {
      kind: "skip",
      externalId: snapshot.externalId,
      reason: "team_not_mapped",
      detail: `home: ${snapshot.homeTeam.externalId} (${snapshot.homeTeam.name})`,
    };
  }
  const awayTeamId = teamMap.get(snapshot.awayTeam.externalId);
  if (!awayTeamId) {
    return {
      kind: "skip",
      externalId: snapshot.externalId,
      reason: "team_not_mapped",
      detail: `away: ${snapshot.awayTeam.externalId} (${snapshot.awayTeam.name})`,
    };
  }
  if (homeTeamId === awayTeamId) {
    return {
      kind: "skip",
      externalId: snapshot.externalId,
      reason: "self_match",
    };
  }

  const dbStatus = providerToDbStatus(snapshot.status);

  if (current === null) {
    const row: MatchInsertRow = {
      stage: snapshot.stage,
      homeTeamId,
      awayTeamId,
      kickoffAt: snapshot.kickoffAt,
      status: dbStatus,
      homeScore: snapshot.scoreAt90?.home ?? null,
      awayScore: snapshot.scoreAt90?.away ?? null,
      homeScoreExtra: snapshot.scoreAtExtra?.home ?? null,
      awayScoreExtra: snapshot.scoreAtExtra?.away ?? null,
      penaltyWinnerTeamId: penaltyWinnerToTeamId(snapshot.penaltyWinner, homeTeamId, awayTeamId),
    };
    return { kind: "insert", row, externalId: snapshot.externalId };
  }

  if (matchId === null) {
    // El orquestador siempre debe pasar matchId cuando current != null.
    throw new Error("reconcileMatch: current row provided without matchId");
  }

  const patch: MatchUpdatePatch = {};

  const nextStatus = chooseStatus(current.status, dbStatus);
  if (nextStatus !== current.status) {
    patch.status = nextStatus;
  }

  // scoreAt90 → home/awayScore (regulación)
  if (snapshot.scoreAt90 !== null) {
    if (snapshot.scoreAt90.home !== current.homeScore) {
      patch.homeScore = snapshot.scoreAt90.home;
    }
    if (snapshot.scoreAt90.away !== current.awayScore) {
      patch.awayScore = snapshot.scoreAt90.away;
    }
  }

  // scoreAtExtra → home/awayScoreExtra (cumulativo final de la prórroga)
  if (snapshot.scoreAtExtra !== null) {
    if (snapshot.scoreAtExtra.home !== current.homeScoreExtra) {
      patch.homeScoreExtra = snapshot.scoreAtExtra.home;
    }
    if (snapshot.scoreAtExtra.away !== current.awayScoreExtra) {
      patch.awayScoreExtra = snapshot.scoreAtExtra.away;
    }
  }

  // penaltyWinner: solo escribir si el provider entrega valor concreto
  if (snapshot.penaltyWinner !== null) {
    const expectedId = penaltyWinnerToTeamId(snapshot.penaltyWinner, homeTeamId, awayTeamId);
    if (expectedId !== current.penaltyWinnerTeamId) {
      patch.penaltyWinnerTeamId = expectedId;
    }
  }

  if (snapshot.kickoffAt.getTime() !== current.kickoffAt.getTime()) {
    patch.kickoffAt = snapshot.kickoffAt;
  }

  if (Object.keys(patch).length === 0) {
    return { kind: "noop", matchId };
  }

  return { kind: "update", matchId, patch };
}

/**
 * Decide el siguiente status. El único caso especial es
 * `prediction-locked`: si la fila ya está bloqueada para
 * predicciones y el provider sigue diciendo `scheduled`, se mantiene
 * el lock. Cualquier transición a `live`/`finished`/etc. la dicta el
 * provider y sobreescribe.
 */
function chooseStatus(current: DbMatchStatus, next: DbMatchStatus): DbMatchStatus {
  if (current === "prediction-locked" && next === "scheduled") {
    return current;
  }
  return next;
}

function penaltyWinnerToTeamId(
  side: "home" | "away" | null,
  homeTeamId: string,
  awayTeamId: string,
): string | null {
  if (side === "home") return homeTeamId;
  if (side === "away") return awayTeamId;
  return null;
}
