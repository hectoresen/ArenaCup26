import type { MatchDataProvider } from "../types";
import { reconcileMatch } from "./reconcile";
import type { MatchRepo, SyncReport } from "./types";

export type SyncFixturesInput = {
  provider: MatchDataProvider;
  repo: MatchRepo;
  leagueId: number;
  season: number;
  /**
   * Hook opcional invocado cuando un match transiciona a `finished`
   * en este sync (no estaba en `finished` antes y el update lo pone).
   * El caller (cron handler) lo cabla con `processFinishedMatch` para
   * calcular puntos. Si no se pasa, no se hace nada extra — útil para
   * tests del orquestador en aislamiento.
   */
  onMatchFinished?: (matchId: string) => Promise<void>;
};

/**
 * Orquestador del pipeline. Llama al provider, reconcilia cada
 * snapshot frente al estado actual de la BD, y aplica los inserts /
 * updates resultantes.
 *
 * - `ProviderError` lanzado por `provider.getFixtures` se propaga: el
 *   caller (cron handler) decide cómo loggear/retry. No queremos que
 *   un fallo de auth se camufle como `errors[]`.
 * - Errores por partido en la capa de persistencia se capturan y
 *   acumulan en `report.errors` (best-effort: un fallo no aborta el
 *   lote).
 * - Idempotente: ejecutar dos veces seguidas con el mismo input
 *   produce un segundo reporte con `inserted: 0, updated: 0`.
 */
export async function syncFixtures(input: SyncFixturesInput): Promise<SyncReport> {
  const { provider, repo, leagueId, season, onMatchFinished } = input;
  const source = provider.name;
  const finishedTransitions: string[] = [];

  const snapshots = await provider.getFixtures({ leagueId, season });

  const teamMap = await repo.loadTeamMap(source);
  const matchMap = new Map(await repo.loadMatchMap(source));

  const report: SyncReport = {
    source,
    inserted: 0,
    updated: 0,
    noop: 0,
    skipped: 0,
    errors: [],
  };

  for (const snapshot of snapshots) {
    try {
      const matchId = matchMap.get(snapshot.externalId) ?? null;
      const current = matchId === null ? null : await repo.loadMatchById(matchId);

      const result = reconcileMatch({ current, matchId, snapshot, teamMap });

      switch (result.kind) {
        case "insert": {
          const newId = await repo.insertMatch(result.row, result.externalId, source);
          matchMap.set(result.externalId, newId);
          report.inserted++;
          // Caso raro pero posible: el provider trae un match ya
          // finalizado que aún no existía en BD. Lo procesamos también.
          if (result.row.status === "finished") {
            finishedTransitions.push(newId);
          }
          break;
        }
        case "update": {
          await repo.updateMatch(result.matchId, result.patch);
          report.updated++;
          // Detección de transición a `finished`: el current existía y
          // NO estaba en finished, y el patch lo pone en finished.
          if (
            current &&
            current.status !== "finished" &&
            result.patch.status === "finished"
          ) {
            finishedTransitions.push(result.matchId);
          }
          break;
        }
        case "noop": {
          report.noop++;
          break;
        }
        case "skip": {
          report.skipped++;
          report.errors.push({
            externalId: result.externalId,
            reason: result.reason,
            detail: result.detail,
          });
          break;
        }
      }
    } catch (err) {
      report.errors.push({
        externalId: snapshot.externalId,
        reason: "persist_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Disparar el hook de finished tras el batch. Fallos aquí se
  // capturan como `report.errors` para no abortar.
  if (onMatchFinished && finishedTransitions.length > 0) {
    for (const matchId of finishedTransitions) {
      try {
        await onMatchFinished(matchId);
      } catch (err) {
        report.errors.push({
          externalId: matchId,
          reason: "finished_hook_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return report;
}
