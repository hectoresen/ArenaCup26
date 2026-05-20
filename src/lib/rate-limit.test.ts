import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRateLimitStoreForTests,
  checkCronLimit,
  checkPublicReadLimit,
  checkSignupLimit,
  checkSubmitLimit,
  isRateLimitEnabled,
} from "./rate-limit";

/**
 * Tests del rate-limit in-memory. Cubren:
 *  - El limiter cuenta correctamente dentro de la ventana.
 *  - Bloquea al superar el límite.
 *  - Distintos scopes son independientes.
 *  - Cambiar de ventana resetea el contador.
 *  - El store se purga adecuadamente entre suites (no leakage).
 */

beforeEach(() => {
  __resetRateLimitStoreForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rate-limit — happy path", () => {
  it("isRateLimitEnabled is always true (in-memory)", () => {
    expect(isRateLimitEnabled()).toBe(true);
  });

  it("first hit returns ok:true and decrements remaining", async () => {
    const r = await checkSubmitLimit("user-1");
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(9); // limit=10 → remaining=9 tras el primer hit
  });

  it("counts within the same window", async () => {
    const a = await checkSubmitLimit("user-1");
    const b = await checkSubmitLimit("user-1");
    expect(a.remaining).toBe(9);
    expect(b.remaining).toBe(8);
  });

  it("blocks once count exceeds limit", async () => {
    // submit limit = 10/min. Disparamos 11 hits del mismo userId.
    let last = { ok: true, remaining: 0, reset: 0 };
    for (let i = 0; i < 11; i++) {
      last = await checkSubmitLimit("spammer");
    }
    expect(last.ok).toBe(false);
    expect(last.remaining).toBe(0);
  });

  it("scopes son independientes (mismo identifier no se cruza)", async () => {
    // Saturar submit no bloquea publicRead aunque la "id" sea similar.
    for (let i = 0; i < 11; i++) {
      await checkSubmitLimit("user-1");
    }
    const submit = await checkSubmitLimit("user-1");
    const read = await checkPublicReadLimit("user-1");
    expect(submit.ok).toBe(false);
    expect(read.ok).toBe(true);
  });

  it("identifiers distintos no se cruzan dentro del mismo scope", async () => {
    for (let i = 0; i < 11; i++) {
      await checkSubmitLimit("user-1");
    }
    const own = await checkSubmitLimit("user-1");
    const other = await checkSubmitLimit("user-2");
    expect(own.ok).toBe(false);
    expect(other.ok).toBe(true);
  });
});

describe("rate-limit — ventanas", () => {
  it("reset apunta al fin de la ventana actual", async () => {
    vi.setSystemTime(new Date("2026-05-20T10:00:00Z"));
    const r = await checkSubmitLimit("user-1");
    // Ventana de 60s → reset al borde del minuto siguiente.
    expect(r.reset).toBe(new Date("2026-05-20T10:01:00Z").getTime());
    vi.useRealTimers();
  });

  it("cruzar la ventana resetea el contador", async () => {
    vi.setSystemTime(new Date("2026-05-20T10:00:00Z"));
    for (let i = 0; i < 11; i++) {
      await checkSubmitLimit("user-1");
    }
    expect((await checkSubmitLimit("user-1")).ok).toBe(false);

    // Saltamos a la siguiente ventana — el contador anterior no nos
    // sigue. La primera petición del minuto nuevo es nueva.
    vi.setSystemTime(new Date("2026-05-20T10:01:30Z"));
    const fresh = await checkSubmitLimit("user-1");
    expect(fresh.ok).toBe(true);
    expect(fresh.remaining).toBe(9);
    vi.useRealTimers();
  });
});

describe("rate-limit — defaults por scope", () => {
  it("cron usa limit=6", async () => {
    let last = { ok: true, remaining: 0, reset: 0 };
    for (let i = 0; i < 7; i++) {
      last = await checkCronLimit("1.2.3.4");
    }
    expect(last.ok).toBe(false);
  });

  it("publicRead usa limit=60", async () => {
    let last = { ok: true, remaining: 0, reset: 0 };
    for (let i = 0; i < 61; i++) {
      last = await checkPublicReadLimit("1.2.3.4");
    }
    expect(last.ok).toBe(false);
  });

  it("signup usa limit=5 y ventana 3600s", async () => {
    let last = { ok: true, remaining: 0, reset: 0 };
    for (let i = 0; i < 6; i++) {
      last = await checkSignupLimit("1.2.3.4");
    }
    expect(last.ok).toBe(false);
    // Ventana de 1h: `reset` siempre cae en el futuro y como mucho a 1h
    // de "ahora" (dependiendo de en qué punto de la hora estemos al
    // correr el test).
    const delta = last.reset - Date.now();
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(3600 * 1000);
  });
});
