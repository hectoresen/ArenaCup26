import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { createApiFootballProvider } from "@/server/match-data/providers/api-football";
import { createMatchRepo } from "@/server/match-data/sync/repo";
import { syncFixtures } from "@/server/match-data/sync/sync";
import { processFinishedMatch } from "@/server/scoring/pipeline";
import { handleCronRequest } from "./handler";

export async function POST(req: Request) {
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
      const provider = createApiFootballProvider({
        apiKey: env.API_FOOTBALL_KEY,
        baseUrl: env.API_FOOTBALL_BASE_URL,
      });
      const repo = createMatchRepo(db);
      return syncFixtures({
        provider,
        repo,
        leagueId: env.MATCH_DATA_LEAGUE_ID,
        season: env.MATCH_DATA_SEASON,
        onMatchFinished: async (matchId) => {
          await processFinishedMatch(db, matchId);
        },
      });
    },
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
