import { describe, expect, it, vi } from "vitest";
import { handleLiveCronRequest, type CronHandlerEnv } from "./handler";
import { ProviderError } from "@/server/match-data/types";

vi.mock("@/lib/rate-limit", () => ({
  checkCronLimit: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/request-ip", () => ({
  getRequestIp: () => "127.0.0.1",
}));

const PROD_ENV: CronHandlerEnv = {
  CRON_SECRET: "topsecret",
  API_FOOTBALL_KEY: "k",
  NODE_ENV: "production",
};

function buildReq(method: string, headers: Record<string, string>) {
  return {
    method,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

const reportOk = {
  source: "test",
  fetched: 1,
  inserted: 0,
  updated: 1,
  unchanged: 0,
  noop: 0,
  skipped: 0,
  teamsInserted: 0,
  finishedTransitions: [],
  errors: [],
};

describe("live-scoring handler", () => {
  it("returns 204 when shouldSync returns sync=false", async () => {
    const res = await handleLiveCronRequest(
      buildReq("POST", { authorization: "Bearer topsecret" }),
      {
        env: PROD_ENV,
        shouldSync: async () => ({ sync: false }),
        runSync: vi.fn(),
      },
    );
    expect(res.status).toBe(204);
  });

  it("runs sync and returns 200 with reason when shouldSync says yes", async () => {
    const runSync = vi.fn(async () => reportOk);
    const res = await handleLiveCronRequest(
      buildReq("POST", { authorization: "Bearer topsecret" }),
      {
        env: PROD_ENV,
        shouldSync: async () => ({
          sync: true,
          reason: "live_in_progress",
          sample: "match-123",
        }),
        runSync,
      },
    );
    expect(res.status).toBe(200);
    expect(runSync).toHaveBeenCalledOnce();
    if (res.status === 200) {
      expect(res.body.reason).toBe("live_in_progress");
      expect(res.body.sample).toBe("match-123");
    }
  });

  it("returns 401 with wrong bearer", async () => {
    const res = await handleLiveCronRequest(
      buildReq("POST", { authorization: "Bearer wrong" }),
      {
        env: PROD_ENV,
        shouldSync: async () => ({ sync: true, reason: "live_in_progress", sample: "x" }),
        runSync: async () => reportOk,
      },
    );
    expect(res.status).toBe(401);
  });

  it("rejects GET with 405", async () => {
    const res = await handleLiveCronRequest(buildReq("GET", {}), {
      env: PROD_ENV,
      shouldSync: async () => ({ sync: false }),
      runSync: vi.fn(),
    });
    expect(res.status).toBe(405);
  });

  it("translates ProviderError to 502", async () => {
    const res = await handleLiveCronRequest(
      buildReq("POST", { authorization: "Bearer topsecret" }),
      {
        env: PROD_ENV,
        shouldSync: async () => ({ sync: true, reason: "live_in_progress", sample: "x" }),
        runSync: async () => {
          // ProviderError(message, source, code, httpStatus?, details?).
          throw new ProviderError("rate limited by api-football", "api-football", "rate_limited");
        },
      },
    );
    expect(res.status).toBe(502);
  });

  it("returns 500 when API_FOOTBALL_KEY is missing", async () => {
    const res = await handleLiveCronRequest(
      buildReq("POST", { authorization: "Bearer topsecret" }),
      {
        env: { ...PROD_ENV, API_FOOTBALL_KEY: undefined },
        shouldSync: async () => ({ sync: true, reason: "live_in_progress", sample: "x" }),
        runSync: async () => reportOk,
      },
    );
    expect(res.status).toBe(500);
    if (res.status === 500) expect(res.body.error).toBe("provider_not_configured");
  });
});
