import { NextResponse } from "next/server";
import { dlog, derr } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { createApiFootballProvider } from "@/server/match-data/providers/api-football";
import { createMatchRepo } from "@/server/match-data/sync/repo";
import { shouldSyncLive } from "@/server/match-data/sync/should-sync-live";
import { syncFixtures } from "@/server/match-data/sync/sync";
import { processFinishedMatch } from "@/server/scoring/pipeline";
import { handleLiveCronRequest } from "./handler";

/**
 * Cron de live-scoring (cada 2 min vía GitHub Actions). Refresca el
 * marcador SOLO cuando hay partidos relevantes:
 *  - Algún match con `status = 'live'`.
 *  - Algún kickoff en los próximos 15 min o en los últimos 30 min.
 *
 * Si no hay nada que refrescar → 200 con `synced: false` sin tocar
 * api-football.
 * Si lo hay → date-window de hoy únicamente (1 fetch al provider).
 *
 * Mismo Bearer auth + rate-limit que `sync-fixtures`.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  dlog("cron", "POST /api/cron/live-scoring received", {
    hasSecret: Boolean(env.CRON_SECRET),
  });

  const result = await handleLiveCronRequest(req, {
    env: {
      CRON_SECRET: env.CRON_SECRET,
      API_FOOTBALL_KEY: env.API_FOOTBALL_KEY,
      NODE_ENV: env.NODE_ENV,
    },
    shouldSync: () => shouldSyncLive(db),
    runSync: async () => {
      if (!env.API_FOOTBALL_KEY) throw new Error("unreachable");
      const provider = createApiFootballProvider({
        apiKey: env.API_FOOTBALL_KEY,
        baseUrl: env.API_FOOTBALL_BASE_URL,
      });
      const repo = createMatchRepo(db);

      // Ventana hoy únicamente — la regla "vivo ahora o muy cerca de
      // kickoff" no necesita mirar 9 días hacia atrás/adelante. Esto
      // reduce 9 requests/api-call a 1 (free-tier api-football).
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

      dlog("cron", "invoking syncFixtures (live window)", {
        from: todayStart.toISOString(),
        to: tomorrowStart.toISOString(),
      });
      return syncFixtures({
        provider,
        repo,
        fetch: {
          mode: "date-window",
          from: todayStart,
          to: tomorrowStart,
          leagueIds:
            env.MATCH_DATA_LEAGUE_FILTER.length > 0
              ? env.MATCH_DATA_LEAGUE_FILTER
              : undefined,
        },
        onMatchFinished: async (matchId) => {
          dlog("cron", "live-scoring: match finished, processing scoring", { matchId });
          const r = await processFinishedMatch(db, matchId);
          dlog("cron", "live-scoring: processFinishedMatch result", r);
        },
      });
    },
  });

  const elapsedMs = Date.now() - startedAt;
  if (result.status >= 400) {
    derr("cron", `live-scoring responded ${result.status} in ${elapsedMs}ms`, result.body);
  } else {
    dlog("cron", `live-scoring responded ${result.status} in ${elapsedMs}ms`, result.body);
  }
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
