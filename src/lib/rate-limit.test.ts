import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests del módulo rate-limit con mock del cliente Upstash.
 *
 * El módulo lee env vars en top-level así que necesitamos resetear
 * el cache de imports entre tests (`vi.resetModules`) para que el
 * `isEnabled` se re-evalúe cuando cambiamos `process.env`.
 */

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("rate-limit — noop mode", () => {
  it("returns ok:true when UPSTASH env vars are absent", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const mod = await import("./rate-limit");
    expect(mod.isRateLimitEnabled()).toBe(false);
    const r = await mod.checkSubmitLimit("user-1");
    expect(r.ok).toBe(true);
  });

  it("noop result has placeholder remaining/reset", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const mod = await import("./rate-limit");
    const r = await mod.checkCronLimit("1.2.3.4");
    expect(r.remaining).toBe(999);
    expect(r.reset).toBe(0);
  });

  it("all four limiters behave the same in noop mode", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const mod = await import("./rate-limit");
    const results = await Promise.all([
      mod.checkSubmitLimit("u"),
      mod.checkCronLimit("ip"),
      mod.checkPublicReadLimit("ip"),
      mod.checkSignupLimit("ip"),
    ]);
    for (const r of results) {
      expect(r.ok).toBe(true);
    }
  });
});

describe("rate-limit — enabled mode (mocked Upstash)", () => {
  it("returns ok:true when Upstash says success", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class {
        // biome-ignore lint/complexity/noUselessConstructor: matches Ratelimit constructor signature
        constructor(_config: unknown) {}
        async limit(_id: string) {
          return { success: true, remaining: 9, reset: Date.now() + 60000, limit: 10, pending: Promise.resolve() };
        }
        static slidingWindow(_count: number, _window: string) {
          return {};
        }
      },
    }));
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        // biome-ignore lint/complexity/noUselessConstructor: matches Redis constructor signature
        constructor(_config: unknown) {}
      },
    }));
    const mod = await import("./rate-limit");
    expect(mod.isRateLimitEnabled()).toBe(true);
    const r = await mod.checkSubmitLimit("user-1");
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(9);
  });

  it("returns ok:false when Upstash says rate limited", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class {
        // biome-ignore lint/complexity/noUselessConstructor: matches Ratelimit constructor signature
        constructor(_config: unknown) {}
        async limit(_id: string) {
          return { success: false, remaining: 0, reset: Date.now() + 60000, limit: 10, pending: Promise.resolve() };
        }
        static slidingWindow(_count: number, _window: string) {
          return {};
        }
      },
    }));
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        // biome-ignore lint/complexity/noUselessConstructor: matches Redis constructor signature
        constructor(_config: unknown) {}
      },
    }));
    const mod = await import("./rate-limit");
    const r = await mod.checkSubmitLimit("user-1");
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("when Upstash throws, falls back to ok:true (fail open)", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class {
        // biome-ignore lint/complexity/noUselessConstructor: matches Ratelimit constructor signature
        constructor(_config: unknown) {}
        async limit(_id: string): Promise<never> {
          throw new Error("Redis down");
        }
        static slidingWindow(_count: number, _window: string) {
          return {};
        }
      },
    }));
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        // biome-ignore lint/complexity/noUselessConstructor: matches Redis constructor signature
        constructor(_config: unknown) {}
      },
    }));
    const mod = await import("./rate-limit");
    const r = await mod.checkSubmitLimit("user-1");
    // Política "fail open" — preferimos no bloquear al user legítimo
    // si nuestro propio servicio de rate limit se cae.
    expect(r.ok).toBe(true);
  });
});
