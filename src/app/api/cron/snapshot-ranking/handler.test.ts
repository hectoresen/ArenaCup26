import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CronHandlerEnv, handleSnapshotCronRequest } from "./handler";

// Bypass rate-limit y get IP en estos tests unitarios. El handler
// real ya usa estos módulos en producción.
vi.mock("@/lib/rate-limit", () => ({
  checkCronLimit: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/request-ip", () => ({
  getRequestIp: () => "127.0.0.1",
}));

const PROD_ENV: CronHandlerEnv = {
  CRON_SECRET: "topsecret",
  NODE_ENV: "production",
};

const DEV_ENV: CronHandlerEnv = {
  CRON_SECRET: undefined,
  NODE_ENV: "development",
};

function buildReq(method: string, headers: Record<string, string>) {
  return {
    method,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

const okSnapshot = vi.fn(async () => ({
  date: new Date("2026-05-15T00:00:00.000Z"),
  usersSnapshotted: 12,
}));

describe("snapshot-ranking handler", () => {
  beforeEach(() => {
    okSnapshot.mockClear();
  });

  it("rejects GET with 405", async () => {
    const res = await handleSnapshotCronRequest(buildReq("GET", {}), {
      env: PROD_ENV,
      runSnapshot: okSnapshot,
    });
    expect(res.status).toBe(405);
  });

  it("returns 401 when CRON_SECRET is set but header is missing", async () => {
    const res = await handleSnapshotCronRequest(buildReq("POST", {}), {
      env: PROD_ENV,
      runSnapshot: okSnapshot,
    });
    expect(res.status).toBe(401);
    expect(okSnapshot).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong bearer", async () => {
    const res = await handleSnapshotCronRequest(
      buildReq("POST", { authorization: "Bearer wrong" }),
      { env: PROD_ENV, runSnapshot: okSnapshot },
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with valid bearer and snapshot report", async () => {
    const res = await handleSnapshotCronRequest(
      buildReq("POST", { authorization: "Bearer topsecret" }),
      { env: PROD_ENV, runSnapshot: okSnapshot },
    );
    expect(res.status).toBe(200);
    expect(okSnapshot).toHaveBeenCalledOnce();
    if (res.status === 200) {
      expect(res.body.usersSnapshotted).toBe(12);
    }
  });

  it("returns 401 in production without CRON_SECRET configured", async () => {
    const res = await handleSnapshotCronRequest(buildReq("POST", {}), {
      env: { ...PROD_ENV, CRON_SECRET: undefined },
      runSnapshot: okSnapshot,
    });
    expect(res.status).toBe(401);
  });

  it("accepts request in dev without CRON_SECRET (open for local testing)", async () => {
    const res = await handleSnapshotCronRequest(buildReq("POST", {}), {
      env: DEV_ENV,
      runSnapshot: okSnapshot,
    });
    expect(res.status).toBe(200);
  });

  it("returns 500 when runSnapshot throws", async () => {
    const failingSnapshot = vi.fn(async () => {
      throw new Error("db down");
    });
    const res = await handleSnapshotCronRequest(
      buildReq("POST", { authorization: "Bearer topsecret" }),
      { env: PROD_ENV, runSnapshot: failingSnapshot },
    );
    expect(res.status).toBe(500);
    if (res.status === 500) expect(res.body.message).toBe("db down");
  });
});
