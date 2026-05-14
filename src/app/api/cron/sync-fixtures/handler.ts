import type { SyncReport } from "@/server/match-data/sync/types";
import { ProviderError } from "@/server/match-data/types";

export type CronHandlerEnv = {
  CRON_SECRET: string | undefined;
  API_FOOTBALL_KEY: string | undefined;
  NODE_ENV: "development" | "production" | "test";
};

export type CronHandlerDeps = {
  env: CronHandlerEnv;
  runSync: () => Promise<SyncReport>;
};

export type CronResponse =
  | { status: 200; body: SyncReport }
  | { status: 401; body: { error: "unauthorized" } }
  | { status: 405; body: { error: "method_not_allowed" } }
  | {
      status: 500;
      body:
        | { error: "provider_not_configured"; detail: string }
        | { error: "internal_error"; message: string };
    }
  | { status: 502; body: { error: "provider_failed"; code: string; message: string } };

/**
 * Handler puro del cron de sync. Aislado del runtime Next/Vercel para
 * que sea testeable sin levantar servidor. La capa adelante (route.ts)
 * traduce esto a `NextResponse`.
 */
export async function handleCronRequest(
  req: { method: string; headers: { get(name: string): string | null } },
  deps: CronHandlerDeps,
): Promise<CronResponse> {
  if (req.method !== "POST") {
    return { status: 405, body: { error: "method_not_allowed" } };
  }

  if (!isAuthorized(req, deps.env)) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  if (!deps.env.API_FOOTBALL_KEY) {
    return {
      status: 500,
      body: { error: "provider_not_configured", detail: "API_FOOTBALL_KEY missing" },
    };
  }

  try {
    const report = await deps.runSync();
    return { status: 200, body: report };
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
  if (!expected) {
    // En dev sin secret configurado, aceptamos cualquiera para poder
    // probar a mano. En producción esto se cierra automáticamente porque
    // el deploy debería traer CRON_SECRET vía Vercel env vars.
    return env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}
