import { derr, dlog } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { createApiFootballProvider } from "@/server/match-data/providers/api-football";
import { createMatchRepo } from "@/server/match-data/sync/repo";
import { shouldSyncLive } from "@/server/match-data/sync/should-sync-live";
import { syncFixtures } from "@/server/match-data/sync/sync";
import { triggerKickoffReminders } from "@/server/notifications/kickoff-reminders";
import { processFinishedMatch } from "@/server/scoring/pipeline";

/**
 * Self-scheduler in-process para el live-scoring.
 *
 * **Por qué existe**: GitHub Actions free tier honra los `cron`
 * `*\/2 * * * *` (cada 2 min) a intervalos reales de **30-60 min**
 * durante periodos de alta carga global. Documentado por GitHub y
 * observado en producción (incidente 2026-05-20): el cron lo único
 * que garantiza es "se ejecutará en algún momento". Para datos de
 * marcador en vivo eso no sirve — un partido de 90 min puede pasar
 * entero sin un solo refresh.
 *
 * Solución: cada proceso Node del wmundial se programa a sí mismo
 * con `setInterval` y ejecuta la misma lógica que el cron HTTP
 * `/api/cron/live-scoring`, pero **sin pasar por HTTP** — invoca
 * directamente las funciones server. Sin red, sin bearer, sin
 * dependencias externas. La cadencia es la del propio event loop
 * de Node: real cada `TICK_MS`.
 *
 * Tradeoffs:
 *  - Single-instance only. Si Railway escala a N réplicas, cada una
 *    correría su tick → trabajo duplicado. Asumido — el setup actual
 *    es single-instance y la idempotencia del sync (upsert por
 *    external_id) evita corrupción si llegara a ocurrir.
 *  - Si el process se duerme/crashea, perdemos ticks. Mitigado con
 *    un tick inmediato al arranque (catch-up tras deploy).
 *  - El cron de GitHub Actions sigue activo como **safety net** —
 *    si in-process falla por bug nuevo, el HTTP cron eventualmente
 *    cubre. Redundancia barata.
 */

/** Cadencia objetivo del tick interno. */
const TICK_MS = 2 * 60_000;

let started = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Arranca el scheduler. Idempotente — múltiples llamadas no
 * duplican el interval. Solo aplica en runtime de producción y solo
 * si `API_FOOTBALL_KEY` está presente (sin clave no hay nada que
 * sincronizar y arrancar el tick sería ruido).
 */
export function startInProcessScheduler(): void {
  if (started) return;
  if (env.NODE_ENV !== "production") {
    dlog("cron", "in-process scheduler skipped (NODE_ENV != production)");
    return;
  }
  if (!env.API_FOOTBALL_KEY) {
    dlog("cron", "in-process scheduler skipped (no API_FOOTBALL_KEY)");
    return;
  }
  started = true;

  const tick = async () => {
    const startedAt = Date.now();

    // Kickoff reminders: depende solo de tiempo, no de hay-partidos-
    // ahora. Mismo patrón que el cron HTTP. Aislado en try/catch para
    // no afectar al sync principal.
    try {
      await triggerKickoffReminders(db);
    } catch (err) {
      derr("cron", "in-process kickoff_reminders failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // Live sync solo si hay algo que refrescar (partido en curso o
    // kickoff dentro de ±15/30 min). En estado idle es un solo
    // SELECT trivial — coste ~0.
    try {
      const decision = await shouldSyncLive(db);
      if (!decision.sync) {
        dlog("cron", "in-process tick: nothing to sync", {
          elapsedMs: Date.now() - startedAt,
        });
        return;
      }
      // Provider seguro de instanciar — API_FOOTBALL_KEY validado arriba.
      const provider = createApiFootballProvider({
        apiKey: env.API_FOOTBALL_KEY ?? "",
        baseUrl: env.API_FOOTBALL_BASE_URL,
      });
      const repo = createMatchRepo(db);

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

      // Respeta `MATCH_DATA_MODE` igual que el cron HTTP de
      // sync-fixtures. En modo `season` solo pide los fixtures del
      // torneo configurado (e.g. Mundial 2026), sin contaminar BD con
      // ligas pre-Mundial. En modo `date-window` mantiene el
      // comportamiento previo (ventana de hoy, filtrada por
      // MATCH_DATA_LEAGUE_FILTER si está).
      const fetchOpts =
        env.MATCH_DATA_MODE === "date-window"
          ? ({
              mode: "date-window" as const,
              from: todayStart,
              to: tomorrowStart,
              leagueIds:
                env.MATCH_DATA_LEAGUE_FILTER.length > 0 ? env.MATCH_DATA_LEAGUE_FILTER : undefined,
            } as const)
          : ({
              mode: "season" as const,
              leagueId: env.MATCH_DATA_LEAGUE_ID,
              season: env.MATCH_DATA_SEASON,
            } as const);

      const report = await syncFixtures({
        provider,
        repo,
        fetch: fetchOpts,
        onMatchFinished: async (matchId) => {
          dlog("cron", "in-process: match finished, scoring", { matchId });
          const r = await processFinishedMatch(db, matchId);
          dlog("cron", "in-process: scoring done", r);
        },
      });

      dlog("cron", "in-process live-scoring done", {
        elapsedMs: Date.now() - startedAt,
        reason: decision.reason,
        inserted: report.inserted,
        updated: report.updated,
        noop: report.noop,
        skipped: report.skipped,
        errors: report.errors.length,
      });
    } catch (err) {
      derr("cron", "in-process live-scoring failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Tick inicial inmediato — tras un deploy queremos ponernos al día
  // sin esperar el primer interval.
  void tick();

  intervalHandle = setInterval(() => void tick(), TICK_MS);

  // Cleanup defensivo para tests / hot-reload (no debería darse en
  // producción real). Si el process recibe SIGTERM/SIGINT, paramos
  // el interval para que Node pueda cerrar limpio sin esperar el
  // próximo tick.
  const stop = () => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    started = false;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  dlog("cron", "in-process scheduler started", { tickMs: TICK_MS });
}
