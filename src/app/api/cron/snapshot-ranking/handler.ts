import { checkCronLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import type { SnapshotReport } from "@/server/ranking-history/snapshot";

export type CronHandlerEnv = {
  CRON_SECRET: string | undefined;
  NODE_ENV: "development" | "production" | "test";
};

export type CronHandlerDeps = {
  env: CronHandlerEnv;
  runSnapshot: () => Promise<SnapshotReport>;
};

export type CronResponse =
  | { status: 200; body: SnapshotReport }
  | { status: 401; body: { error: "unauthorized" } }
  | { status: 405; body: { error: "method_not_allowed" } }
  | { status: 429; body: { error: "rate_limited" } }
  | { status: 500; body: { error: "internal_error"; message: string } };

/**
 * Handler puro del cron de snapshot de ranking. Misma forma que
 * `sync-fixtures/handler.ts` — separado del runtime Next para tests
 * unitarios.
 */
export async function handleSnapshotCronRequest(
  req: { method: string; headers: { get(name: string): string | null } },
  deps: CronHandlerDeps,
): Promise<CronResponse> {
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

  try {
    const report = await deps.runSnapshot();
    return { status: 200, body: report };
  } catch (err) {
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
  if (!expected) {
    return env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}
