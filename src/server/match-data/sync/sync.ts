import { dlog } from "@/lib/debug-log";
import type { MatchDataProvider } from "../types";
import { reconcileMatch } from "./reconcile";
import type { MatchRepo, SyncReport } from "./types";

export type SyncFixturesInput = {
  provider: MatchDataProvider;
  repo: MatchRepo;
  /**
   * Cómo pedir fixtures al provider. Forwardeado directamente. Ver
   * `GetFixturesOptions` en `../types.ts` para los dos modos
   * soportados (season completa vs ventana de fechas).
   */
  fetch:
    | { mode: "season"; leagueId: number; season: number }
    | { mode: "date-window"; from: Date; to: Date; leagueIds?: number[] };
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
  const { provider, repo, fetch, onMatchFinished } = input;
  const source = provider.name;
  const finishedTransitions: string[] = [];

  dlog("sync", "fetching fixtures from provider", { source, fetch });
  const snapshots = await provider.getFixtures(fetch);
  dlog("sync", `provider returned ${snapshots.length} snapshots`);

  const teamMapImmutable = await repo.loadTeamMap(source);
  // Mutable copy: el sync irá descubriendo teams nuevos y los inserta
  // al vuelo para que el reconciler los encuentre.
  const teamMap = new Map(teamMapImmutable);
  const matchMap = new Map(await repo.loadMatchMap(source));
  dlog("sync", "repo maps loaded", { teams: teamMap.size, matches: matchMap.size });

  // Primera pasada: upsertar todos los teams desconocidos a partir
  // de los snapshots. Antes esto lo hacía `ensureTeamsSeeded` con un
  // /teams call separado; con el modo date-window ese endpoint no
  // está disponible para seasons en curso en el free tier, así que
  // derivamos los teams directamente de los fixtures.
  const seenExternalIds = new Set<string>();
  let teamsInserted = 0;
  for (const snap of snapshots) {
    for (const team of [snap.homeTeam, snap.awayTeam]) {
      if (teamMap.has(team.externalId) || seenExternalIds.has(team.externalId)) continue;
      seenExternalIds.add(team.externalId);
      try {
        const teamId = await repo.upsertTeamFromProvider(
          {
            externalId: team.externalId,
            name: team.name,
            code: team.code,
            flag: team.logo,
          },
          source,
        );
        teamMap.set(team.externalId, teamId);
        teamsInserted++;
      } catch (err) {
        dlog("sync", "upsertTeamFromProvider failed", {
          externalId: team.externalId,
          name: team.name,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  if (teamsInserted > 0) {
    dlog("sync", `derived ${teamsInserted} new teams from fixtures`);
  }

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
          dlog("sync", "insert", {
            extId: result.externalId,
            newId,
            status: result.row.status,
            stage: result.row.stage,
          });
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
          dlog("sync", "update", {
            matchId: result.matchId,
            patch: result.patch,
            prevStatus: current?.status,
          });
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
          dlog("sync", "skip", {
            extId: result.externalId,
            reason: result.reason,
            detail: result.detail,
          });
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

  dlog("sync", "reconcile loop done", {
    inserted: report.inserted,
    updated: report.updated,
    noop: report.noop,
    skipped: report.skipped,
    finishedTransitions: finishedTransitions.length,
  });

  // Disparar el hook de finished tras el batch. Fallos aquí se
  // capturan como `report.errors` para no abortar.
  if (onMatchFinished && finishedTransitions.length > 0) {
    dlog("sync", `firing onMatchFinished for ${finishedTransitions.length} matches`);
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
