import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests del módulo rate-limit con mock del cliente `@upstash/redis`.
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

function mockRedisWithIncrSequence(...counts: number[]) {
  let idx = 0;
  return {
    Redis: class {
      // biome-ignore lint/complexity/noUselessConstructor: matches Redis constructor signature
      constructor(_config: unknown) {}
      async incr(_key: string) {
        const value = counts[idx] ?? counts[counts.length - 1] ?? 0;
        idx++;
        return value;
      }
      async expire(_key: string, _seconds: number) {
        return 1;
      }
    },
  };
}

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

describe("rate-limit — enabled mode (mocked Redis)", () => {
  it("returns ok:true while count <= limit", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.doMock("@upstash/redis", () => mockRedisWithIncrSequence(1));
    const mod = await import("./rate-limit");
    expect(mod.isRateLimitEnabled()).toBe(true);
    const r = await mod.checkSubmitLimit("user-1");
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(9); // limit=10, count=1 → remaining=9
  });

  it("returns ok:false when count exceeds limit", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.doMock("@upstash/redis", () => mockRedisWithIncrSequence(11));
    const mod = await import("./rate-limit");
    const r = await mod.checkSubmitLimit("user-1");
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("when Redis throws, falls back to ok:true (fail open)", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        // biome-ignore lint/complexity/noUselessConstructor: matches Redis constructor signature
        constructor(_config: unknown) {}
        async incr(_key: string): Promise<never> {
          throw new Error("Redis down");
        }
      },
    }));
    const mod = await import("./rate-limit");
    const r = await mod.checkSubmitLimit("user-1");
    // Política "fail open" — preferimos no bloquear al user legítimo
    // si nuestro propio servicio de rate limit se cae.
    expect(r.ok).toBe(true);
  });

  it("different scopes have independent limits", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    // Submit limit=10; publicRead limit=60. Mismo backend, scopes
    // distintos → claves distintas → contadores distintos. Aquí
    // ambos checks reciben count=11; el primero supera su límite,
    // el segundo no.
    vi.doMock("@upstash/redis", () => mockRedisWithIncrSequence(11, 11));
    const mod = await import("./rate-limit");
    const submit = await mod.checkSubmitLimit("user-1");
    const read = await mod.checkPublicReadLimit("ip-1");
    expect(submit.ok).toBe(false);
    expect(read.ok).toBe(true);
  });
});
