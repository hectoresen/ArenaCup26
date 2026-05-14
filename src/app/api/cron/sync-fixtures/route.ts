import { NextResponse } from "next/server";
import { dlog, derr } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { createApiFootballProvider } from "@/server/match-data/providers/api-football";
import { createMatchRepo } from "@/server/match-data/sync/repo";
import { syncFixtures } from "@/server/match-data/sync/sync";
import { ensureTeamsSeeded } from "@/server/match-data/teams-seed";
import { processFinishedMatch } from "@/server/scoring/pipeline";
import { handleCronRequest } from "./handler";

export async function POST(req: Request) {
  const startedAt = Date.now();
  dlog("cron", "POST /api/cron/sync-fixtures received", {
    league: env.MATCH_DATA_LEAGUE_ID,
    season: env.MATCH_DATA_SEASON,
    hasSecret: Boolean(env.CRON_SECRET),
  });

  const result = await handleCronRequest(req, {
    env: {
      CRON_SECRET: env.CRON_SECRET,
      API_FOOTBALL_KEY: env.API_FOOTBALL_KEY,
      NODE_ENV: env.NODE_ENV,
    },
    runSync: async () => {
      // No instanciamos el provider hasta superar la auth; así en
      // requests no autorizadas no construimos clientes con la API key.
      if (!env.API_FOOTBALL_KEY) throw new Error("unreachable");

      // Primer sync: si no hay teams mapeados a api-football, los
      // sembramos automáticamente. Idempotente: a partir del segundo
      // sync este paso es un count(*) trivial y se salta.
      dlog("cron", "ensuring teams seeded");
      await ensureTeamsSeeded({
        db,
        leagueId: env.MATCH_DATA_LEAGUE_ID,
        season: env.MATCH_DATA_SEASON,
        apiKey: env.API_FOOTBALL_KEY,
        baseUrl: env.API_FOOTBALL_BASE_URL,
      });

      const provider = createApiFootballProvider({
        apiKey: env.API_FOOTBALL_KEY,
        baseUrl: env.API_FOOTBALL_BASE_URL,
      });
      const repo = createMatchRepo(db);
      dlog("cron", "invoking syncFixtures");
      return syncFixtures({
        provider,
        repo,
        leagueId: env.MATCH_DATA_LEAGUE_ID,
        season: env.MATCH_DATA_SEASON,
        onMatchFinished: async (matchId) => {
          dlog("cron", "match transitioned to finished, processing scoring", { matchId });
          const r = await processFinishedMatch(db, matchId);
          dlog("cron", "processFinishedMatch result", r);
        },
      });
    },
  });

  const elapsedMs = Date.now() - startedAt;
  if (result.status >= 400) {
    derr("cron", `responded ${result.status} in ${elapsedMs}ms`, result.body);
  } else {
    dlog("cron", `responded ${result.status} in ${elapsedMs}ms`, result.body);
  }
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
