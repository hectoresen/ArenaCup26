import { NextResponse } from "next/server";
import { dlog, derr } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { takeRankingSnapshot } from "@/server/ranking-history/snapshot";
import { handleSnapshotCronRequest } from "./handler";

/**
 * Cron diario que persiste el ranking actual en `ranking_snapshots`.
 * Esquema: 00:05 UTC todos los días desde GitHub Actions o Railway
 * cron. Protegido por `CRON_SECRET` (Bearer header) igual que
 * `sync-fixtures`.
 *
 * Responses:
 *  - 200: `{ date, usersSnapshotted }`.
 *  - 401: secret inválido.
 *  - 429: rate-limit (6/60s por IP).
 *  - 500: error interno.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  dlog("cron", "POST /api/cron/snapshot-ranking received", {
    hasSecret: Boolean(env.CRON_SECRET),
  });

  const result = await handleSnapshotCronRequest(req, {
    env: {
      CRON_SECRET: env.CRON_SECRET,
      NODE_ENV: env.NODE_ENV,
    },
    runSnapshot: () => takeRankingSnapshot(db),
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
