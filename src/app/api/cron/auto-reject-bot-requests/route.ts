import { derr, dlog } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { checkCronLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { autoRejectStaleBotRequests } from "@/server/bots/auto-reject";
import { refreshLiveBotPresence } from "@/server/bots/presence";
import { db } from "@/server/db/client";
import { NextResponse } from "next/server";

/**
 * Cron diario que marca como `rejected` los friend requests y group
 * invitations dirigidos a BOTS con > 48h en `pending`. Limpia la
 * bandeja del solicitante (que de otro modo vería "pending forever").
 *
 * Protegido por `CRON_SECRET` Bearer + rate limit por IP. Mismo
 * patrón que los demás crons del producto.
 *
 * Schedule: 03:30 UTC diario desde GitHub Actions
 * (`.github/workflows/auto-reject-bot-requests.yml`).
 *
 * Responses:
 *  - 200: `{ friendshipsRejected, groupInvitationsRejected }`.
 *  - 401: secret inválido.
 *  - 429: rate-limit.
 *  - 500: error interno.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  dlog("cron", "POST /api/cron/auto-reject-bot-requests received");

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(req.headers);
  const rl = await checkCronLimit(ip);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const report = await autoRejectStaleBotRequests(db);
    // Piggy-back: el mismo cron diario refresca el `lastActiveAt` de
    // los bots "live" para que sigan luciendo con puntito verde en el
    // ranking. Es no-op pasado el cutoff (`LIVE_BOTS_END_DATE`).
    const liveBotsRefreshed = await refreshLiveBotPresence(db);
    const elapsed = Date.now() - startedAt;
    dlog("cron", "auto-reject-bot-requests done", {
      ...report,
      liveBotsRefreshed,
      elapsedMs: elapsed,
    });
    return NextResponse.json({ ...report, liveBotsRefreshed }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    derr("cron", "auto-reject-bot-requests failed", { err: message });
    return NextResponse.json({ error: "internal_error", message }, { status: 500 });
  }
}

function isAuthorized(req: Request): boolean {
  const expected = env.CRON_SECRET;
  if (!expected) {
    // En dev sin secret seteado, dejamos pasar para QA manual.
    return env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}
