import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/server/match-data/types";
import type { SyncReport } from "@/server/match-data/sync/types";
import { handleCronRequest, type CronHandlerEnv } from "./handler";

const EMPTY_REPORT: SyncReport = {
  source: "api-football",
  inserted: 0,
  updated: 0,
  noop: 0,
  skipped: 0,
  errors: [],
};

function buildReq({
  method = "POST",
  authorization,
}: { method?: string; authorization?: string } = {}): {
  method: string;
  headers: { get(name: string): string | null };
} {
  return {
    method,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? authorization ?? null : null,
    },
  };
}

const PROD_ENV: CronHandlerEnv = {
  CRON_SECRET: "topsecret",
  API_FOOTBALL_KEY: "key",
  NODE_ENV: "production",
};

const DEV_NO_SECRET_ENV: CronHandlerEnv = {
  CRON_SECRET: undefined,
  API_FOOTBALL_KEY: "key",
  NODE_ENV: "development",
};

describe("handleCronRequest — auth", () => {
  it("returns 405 for non-POST methods", async () => {
    const result = await handleCronRequest(buildReq({ method: "GET" }), {
      env: PROD_ENV,
      runSync: async () => EMPTY_REPORT,
    });
    expect(result.status).toBe(405);
  });

  it("returns 401 when CRON_SECRET is set but header is missing", async () => {
    const result = await handleCronRequest(buildReq(), {
      env: PROD_ENV,
      runSync: async () => EMPTY_REPORT,
    });
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "unauthorized" });
  });

  it("returns 401 when bearer token doesn't match", async () => {
    const result = await handleCronRequest(
      buildReq({ authorization: "Bearer wrong" }),
      { env: PROD_ENV, runSync: async () => EMPTY_REPORT },
    );
    expect(result.status).toBe(401);
  });

  it("returns 401 in production without CRON_SECRET configured (refuse to expose endpoint)", async () => {
    const result = await handleCronRequest(buildReq(), {
      env: { ...PROD_ENV, CRON_SECRET: undefined },
      runSync: async () => EMPTY_REPORT,
    });
    expect(result.status).toBe(401);
  });

  it("accepts request in dev without CRON_SECRET (open for local testing)", async () => {
    const result = await handleCronRequest(buildReq(), {
      env: DEV_NO_SECRET_ENV,
      runSync: async () => EMPTY_REPORT,
    });
    expect(result.status).toBe(200);
  });

  it("accepts request when bearer token matches", async () => {
    const result = await handleCronRequest(
      buildReq({ authorization: "Bearer topsecret" }),
      { env: PROD_ENV, runSync: async () => EMPTY_REPORT },
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual(EMPTY_REPORT);
  });
});

describe("handleCronRequest — outcomes", () => {
  it("returns 500 if API_FOOTBALL_KEY is missing", async () => {
    const result = await handleCronRequest(
      buildReq({ authorization: "Bearer topsecret" }),
      {
        env: { ...PROD_ENV, API_FOOTBALL_KEY: undefined },
        runSync: async () => EMPTY_REPORT,
      },
    );
    expect(result.status).toBe(500);
    if (result.status === 500) {
      expect(result.body).toMatchObject({ error: "provider_not_configured" });
    }
  });

  it("returns 502 with provider error code when ProviderError is thrown", async () => {
    const runSync = vi.fn(async () => {
      throw new ProviderError("plan limited", "api-football", "plan_limited");
    });
    const result = await handleCronRequest(
      buildReq({ authorization: "Bearer topsecret" }),
      { env: PROD_ENV, runSync },
    );
    expect(result.status).toBe(502);
    if (result.status === 502) {
      expect(result.body.code).toBe("plan_limited");
      expect(result.body.message).toBe("plan limited");
    }
  });

  it("returns 500 with message when an unexpected error occurs", async () => {
    const runSync = vi.fn(async () => {
      throw new Error("connection refused");
    });
    const result = await handleCronRequest(
      buildReq({ authorization: "Bearer topsecret" }),
      { env: PROD_ENV, runSync },
    );
    expect(result.status).toBe(500);
    if (result.status === 500) {
      expect(result.body).toMatchObject({ error: "internal_error", message: "connection refused" });
    }
  });

  it("returns 200 with the SyncReport on success", async () => {
    const report: SyncReport = {
      source: "api-football",
      inserted: 64,
      updated: 0,
      noop: 0,
      skipped: 0,
      errors: [],
    };
    const result = await handleCronRequest(
      buildReq({ authorization: "Bearer topsecret" }),
      { env: PROD_ENV, runSync: async () => report },
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual(report);
  });
});
