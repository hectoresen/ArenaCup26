import { checkCronLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import type { SyncReport } from "@/server/match-data/sync/types";
import type { ShouldSyncLiveResult } from "@/server/match-data/sync/should-sync-live";
import { ProviderError } from "@/server/match-data/types";

export type CronHandlerEnv = {
  CRON_SECRET: string | undefined;
  API_FOOTBALL_KEY: string | undefined;
  NODE_ENV: "development" | "production" | "test";
};

export type CronHandlerDeps = {
  env: CronHandlerEnv;
  shouldSync: () => Promise<ShouldSyncLiveResult>;
  runSync: () => Promise<SyncReport>;
};

export type LiveCronResponse =
  | { status: 200; body: { synced: true; reason: string; sample: string; report: SyncReport } }
  // No-op informativo: respondemos 200 con `synced: false`. HTTP/1.1
  // prohíbe body en 204 y `NextResponse.json(body, {status:204})`
  // lanza unhandled → 500 vacío. El workflow del cron solo abortar
  // con `status >= 400`, así que 200 sigue siendo green-check.
  | { status: 200; body: { synced: false; reason: "no_live_matches" } }
  | { status: 401; body: { error: "unauthorized" } }
  | { status: 405; body: { error: "method_not_allowed" } }
  | { status: 429; body: { error: "rate_limited" } }
  | {
      status: 500;
      body:
        | { error: "provider_not_configured"; detail: string }
        | { error: "internal_error"; message: string };
    }
  | { status: 502; body: { error: "provider_failed"; code: string; message: string } };

/**
 * Handler del cron de live-scoring. Misma forma que sync-fixtures
 * pero con un check previo `shouldSync()` que decide si vale la pena
 * pegarse el viaje al provider. Si no hay partidos relevantes,
 * devuelve 204 sin gastar requests a api-football.
 */
export async function handleLiveCronRequest(
  req: { method: string; headers: { get(name: string): string | null } },
  deps: CronHandlerDeps,
): Promise<LiveCronResponse> {
  if (req.method !== "POST") {
    return { status: 405, body: { error: "method_not_allowed" } };
  }
  if (!isAuthorized(req, deps.env)) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  const ip = getRequestIp(req.headers);
  const rl = await checkCronLimit(ip);
  if (!rl.ok) {
    return { status: 429, body: { error: "rate_limited" } };
  }

  const decision = await deps.shouldSync();
  if (!decision.sync) {
    return { status: 200, body: { synced: false, reason: "no_live_matches" } };
  }

  if (!deps.env.API_FOOTBALL_KEY) {
    return {
      status: 500,
      body: { error: "provider_not_configured", detail: "API_FOOTBALL_KEY missing" },
    };
  }

  try {
    const report = await deps.runSync();
    return {
      status: 200,
      body: { synced: true, reason: decision.reason, sample: decision.sample, report },
    };
  } catch (err) {
    if (err instanceof ProviderError) {
      return {
        status: 502,
        body: { error: "provider_failed", code: err.code, message: err.message },
      };
    }
    return {
      status: 500,
      body: { error: "internal_error", message: err instanceof Error ? err.message : String(err) },
    };
  }
}

function isAuthorized(
  req: { headers: { get(name: string): string | null } },
  env: CronHandlerEnv,
): boolean {
  const expected = env.CRON_SECRET;
  if (!expected) return env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}
