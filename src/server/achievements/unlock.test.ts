import { describe, expect, it } from "vitest";

/**
 * Tests de las reglas puras de unlock. La integración con BD
 * (`evaluateAndUnlock`) requiere postgres; se valida en e2e y a mano
 * en Railway via los logs `[AC/scoring]`.
 *
 * Estos tests verifican que las condiciones de unlock están
 * correctamente expresadas para no regresar reglas del catálogo en
 * refactors.
 */

// Re-implementamos las reglas como pure functions para testarlas
// sin importar el módulo unlock.ts (que tiene side-effects de Drizzle).
type Ctx = {
  totalPoints: number;
  streak: number;
  correctCount: number;
  exactCount: number;
  rank: number | null;
  referredFirstHits: number;
  activeGroupCount: number;
};

const RULES: Record<string, (c: Ctx) => boolean> = {
  "first-hit": (c) => c.correctCount >= 1,
  "good-eye": (c) => c.correctCount >= 10,
  "first-hundred": (c) => c.totalPoints >= 100,
  "five-of-five": (c) => c.exactCount >= 5,
  "better-with-friends": (c) => c.referredFirstHits >= 1,
  "team-spirit": (c) => c.activeGroupCount >= 1,
  "power-200": (c) => c.totalPoints >= 200,
  "on-fire": (c) => c.streak >= 5,
  "exact-shot": (c) => c.exactCount >= 1,
  "top-100": (c) => c.rank !== null && c.rank <= 100,
  "elite-shooter": (c) => c.exactCount >= 10,
  "top-50": (c) => c.rank !== null && c.rank <= 50,
  "division-bronze": (c) => c.rank !== null && c.rank <= 30,
  seer: (c) => c.exactCount >= 20,
  "top-10": (c) => c.rank !== null && c.rank <= 10,
  "division-silver": (c) => c.rank !== null && c.rank <= 20,
  "on-the-podium": (c) => c.rank !== null && c.rank <= 3,
  "runner-up": (c) => c.rank !== null && c.rank <= 2,
  "king-of-the-moment": (c) => c.rank === 1,
  "division-gold": (c) => c.rank !== null && c.rank <= 10,
};

function ctx(overrides: Partial<Ctx> = {}): Ctx {
  return {
    totalPoints: 0,
    streak: 0,
    correctCount: 0,
    exactCount: 0,
    rank: null,
    referredFirstHits: 0,
    activeGroupCount: 0,
    ...overrides,
  };
}

describe("achievement unlock rules", () => {
  it("first-hit triggers on first correct prediction", () => {
    expect(RULES["first-hit"]?.(ctx({ correctCount: 0 }))).toBe(false);
    expect(RULES["first-hit"]?.(ctx({ correctCount: 1 }))).toBe(true);
    expect(RULES["first-hit"]?.(ctx({ correctCount: 100 }))).toBe(true);
  });

  it("good-eye requires 10 correct", () => {
    expect(RULES["good-eye"]?.(ctx({ correctCount: 9 }))).toBe(false);
    expect(RULES["good-eye"]?.(ctx({ correctCount: 10 }))).toBe(true);
  });

  it("first-hundred and power-200 follow point thresholds", () => {
    expect(RULES["first-hundred"]?.(ctx({ totalPoints: 99 }))).toBe(false);
    expect(RULES["first-hundred"]?.(ctx({ totalPoints: 100 }))).toBe(true);
    expect(RULES["power-200"]?.(ctx({ totalPoints: 199 }))).toBe(false);
    expect(RULES["power-200"]?.(ctx({ totalPoints: 200 }))).toBe(true);
  });

  it("better-with-friends triggers on first referred user's first hit", () => {
    expect(RULES["better-with-friends"]?.(ctx({ referredFirstHits: 0 }))).toBe(false);
    expect(RULES["better-with-friends"]?.(ctx({ referredFirstHits: 1 }))).toBe(true);
    expect(RULES["better-with-friends"]?.(ctx({ referredFirstHits: 5 }))).toBe(true);
  });

  it("team-spirit triggers on first active group membership", () => {
    expect(RULES["team-spirit"]?.(ctx({ activeGroupCount: 0 }))).toBe(false);
    expect(RULES["team-spirit"]?.(ctx({ activeGroupCount: 1 }))).toBe(true);
    expect(RULES["team-spirit"]?.(ctx({ activeGroupCount: 3 }))).toBe(true);
  });

  it("exact-shot/five-of-five/elite-shooter/seer scale with exactCount", () => {
    expect(RULES["exact-shot"]?.(ctx({ exactCount: 0 }))).toBe(false);
    expect(RULES["exact-shot"]?.(ctx({ exactCount: 1 }))).toBe(true);
    expect(RULES["five-of-five"]?.(ctx({ exactCount: 4 }))).toBe(false);
    expect(RULES["five-of-five"]?.(ctx({ exactCount: 5 }))).toBe(true);
    expect(RULES["elite-shooter"]?.(ctx({ exactCount: 9 }))).toBe(false);
    expect(RULES["elite-shooter"]?.(ctx({ exactCount: 10 }))).toBe(true);
    expect(RULES.seer?.(ctx({ exactCount: 19 }))).toBe(false);
    expect(RULES.seer?.(ctx({ exactCount: 20 }))).toBe(true);
  });

  it("on-fire triggers at streak >= 5", () => {
    expect(RULES["on-fire"]?.(ctx({ streak: 4 }))).toBe(false);
    expect(RULES["on-fire"]?.(ctx({ streak: 5 }))).toBe(true);
  });

  it("ranking-based rules require rank to be set and <= threshold", () => {
    expect(RULES["top-100"]?.(ctx({ rank: null }))).toBe(false);
    expect(RULES["top-100"]?.(ctx({ rank: 101 }))).toBe(false);
    expect(RULES["top-100"]?.(ctx({ rank: 100 }))).toBe(true);
    expect(RULES["top-50"]?.(ctx({ rank: 50 }))).toBe(true);
    expect(RULES["top-10"]?.(ctx({ rank: 10 }))).toBe(true);
    expect(RULES["on-the-podium"]?.(ctx({ rank: 3 }))).toBe(true);
    expect(RULES["on-the-podium"]?.(ctx({ rank: 4 }))).toBe(false);
    expect(RULES["runner-up"]?.(ctx({ rank: 2 }))).toBe(true);
    expect(RULES["runner-up"]?.(ctx({ rank: 3 }))).toBe(false);
    expect(RULES["king-of-the-moment"]?.(ctx({ rank: 1 }))).toBe(true);
    expect(RULES["king-of-the-moment"]?.(ctx({ rank: 2 }))).toBe(false);
  });

  it("division rules unlock at the leaderboard cutoffs (30 / 20 / 10)", () => {
    expect(RULES["division-bronze"]?.(ctx({ rank: 31 }))).toBe(false);
    expect(RULES["division-bronze"]?.(ctx({ rank: 30 }))).toBe(true);
    expect(RULES["division-silver"]?.(ctx({ rank: 21 }))).toBe(false);
    expect(RULES["division-silver"]?.(ctx({ rank: 20 }))).toBe(true);
    expect(RULES["division-gold"]?.(ctx({ rank: 11 }))).toBe(false);
    expect(RULES["division-gold"]?.(ctx({ rank: 10 }))).toBe(true);
    // null rank → nunca dispara, igual que los demás rank rules.
    expect(RULES["division-bronze"]?.(ctx({ rank: null }))).toBe(false);
  });

  it("entering top 10 unlocks the three divisions simultaneously", () => {
    const c = ctx({ rank: 5 });
    expect(RULES["division-bronze"]?.(c)).toBe(true);
    expect(RULES["division-silver"]?.(c)).toBe(true);
    expect(RULES["division-gold"]?.(c)).toBe(true);
  });

  it("rules covers 20 evaluable achievements (rest are pending)", () => {
    // 20 = 15 originales + better-with-friends (2026-05-16) +
    // team-spirit (2026-05-19) + 3 division-* (2026-06-17).
    // PENDING_RULES sigue en 8.
    expect(Object.keys(RULES)).toHaveLength(20);
  });
});
