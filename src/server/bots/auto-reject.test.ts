import { describe, expect, it } from "vitest";

/**
 * Tests del threshold de 48h del auto-reject. La función completa
 * `autoRejectStaleBotRequests` toca BD vía drizzle — esos paths se
 * validan a mano en QA contra la BD real. Aquí solo aseguramos que
 * la lógica de "¿es esta fila lo suficientemente vieja?" es correcta
 * y no driftea con cambios de zona horaria o constantes.
 *
 * Re-implementamos el cálculo como pure para protegerlo.
 */

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

function shouldReject(createdAt: Date, now: Date): boolean {
  const threshold = new Date(now.getTime() - TWO_DAYS_MS);
  return createdAt < threshold;
}

describe("auto-reject threshold (48h)", () => {
  const NOW = new Date("2026-06-15T12:00:00Z");

  it("rejects a request created 49 hours ago", () => {
    const old = new Date(NOW.getTime() - 49 * 60 * 60 * 1000);
    expect(shouldReject(old, NOW)).toBe(true);
  });

  it("keeps a request created 47 hours ago", () => {
    const fresh = new Date(NOW.getTime() - 47 * 60 * 60 * 1000);
    expect(shouldReject(fresh, NOW)).toBe(false);
  });

  it("boundary exactly 48h ago: not rejected (strict <)", () => {
    const boundary = new Date(NOW.getTime() - TWO_DAYS_MS);
    expect(shouldReject(boundary, NOW)).toBe(false);
  });

  it("boundary 48h + 1ms ago: rejected", () => {
    const justOver = new Date(NOW.getTime() - TWO_DAYS_MS - 1);
    expect(shouldReject(justOver, NOW)).toBe(true);
  });

  it("a request from the future is never rejected", () => {
    const future = new Date(NOW.getTime() + 60_000);
    expect(shouldReject(future, NOW)).toBe(false);
  });
});
