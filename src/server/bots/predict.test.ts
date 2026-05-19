import { describe, expect, it } from "vitest";
import { generatePrediction } from "./predict";

/**
 * RNG determinístico simple para tests. Mulberry32 — distribuye bien
 * con seed pequeña, suficiente para validar las proporciones que
 * `generatePrediction` produce sobre miles de runs.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RUNS = 5000;
const TOL = 0.04; // ±4% tolerance en cada bucket.

describe("generatePrediction — simple", () => {
  it("siempre devuelve null en homeScore/awayScore (solo 1X2)", () => {
    const random = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const p = generatePrediction("simple", random);
      expect(p.homeScore).toBeNull();
      expect(p.awayScore).toBeNull();
    }
  });

  it("distribuye outcome ≈ {1/3, 1/3, 1/3}", () => {
    const random = mulberry32(42);
    const counts = { home: 0, draw: 0, away: 0 };
    for (let i = 0; i < RUNS; i++) {
      const p = generatePrediction("simple", random);
      counts[p.outcome]++;
    }
    expect(counts.home / RUNS).toBeCloseTo(1 / 3, 1);
    expect(counts.draw / RUNS).toBeCloseTo(1 / 3, 1);
    expect(counts.away / RUNS).toBeCloseTo(1 / 3, 1);
  });
});

describe("generatePrediction — mixed", () => {
  it("~20% son exactas, ~80% solo 1X2", () => {
    const random = mulberry32(7);
    let exact = 0;
    let simple = 0;
    for (let i = 0; i < RUNS; i++) {
      const p = generatePrediction("mixed", random);
      if (p.homeScore !== null) exact++;
      else simple++;
    }
    const exactRate = exact / RUNS;
    expect(exactRate).toBeGreaterThan(0.2 - TOL);
    expect(exactRate).toBeLessThan(0.2 + TOL);
    expect(simple / RUNS).toBeGreaterThan(0.8 - TOL);
  });

  it("cuando es exacta, el marcador está dentro del rango plausible (0-3 home, 0-3 away)", () => {
    const random = mulberry32(99);
    for (let i = 0; i < RUNS; i++) {
      const p = generatePrediction("mixed", random);
      if (p.homeScore !== null && p.awayScore !== null) {
        expect(p.homeScore).toBeGreaterThanOrEqual(0);
        expect(p.homeScore).toBeLessThanOrEqual(3);
        expect(p.awayScore).toBeGreaterThanOrEqual(0);
        expect(p.awayScore).toBeLessThanOrEqual(3);
      }
    }
  });

  it("outcome coincide con el marcador cuando hay exact", () => {
    const random = mulberry32(13);
    for (let i = 0; i < 500; i++) {
      const p = generatePrediction("mixed", random);
      if (p.homeScore !== null && p.awayScore !== null) {
        if (p.homeScore > p.awayScore) expect(p.outcome).toBe("home");
        else if (p.homeScore < p.awayScore) expect(p.outcome).toBe("away");
        else expect(p.outcome).toBe("draw");
      }
    }
  });
});

describe("generatePrediction — daredevil", () => {
  it("~70% son exactas", () => {
    const random = mulberry32(101);
    let exact = 0;
    for (let i = 0; i < RUNS; i++) {
      const p = generatePrediction("daredevil", random);
      if (p.homeScore !== null) exact++;
    }
    const rate = exact / RUNS;
    expect(rate).toBeGreaterThan(0.7 - TOL);
    expect(rate).toBeLessThan(0.7 + TOL);
  });

  it("el pool de marcadores incluye outliers (4-3, 5-2, etc)", () => {
    const random = mulberry32(2024);
    let seenOutlier = false;
    for (let i = 0; i < RUNS; i++) {
      const p = generatePrediction("daredevil", random);
      if (p.homeScore !== null && p.awayScore !== null) {
        if (p.homeScore >= 4 || p.awayScore >= 4) {
          seenOutlier = true;
          break;
        }
      }
    }
    expect(seenOutlier).toBe(true);
  });
});

describe("determinism", () => {
  it("dos runs con la misma seed producen la misma secuencia", () => {
    const r1 = mulberry32(555);
    const r2 = mulberry32(555);
    for (let i = 0; i < 100; i++) {
      const p1 = generatePrediction("mixed", r1);
      const p2 = generatePrediction("mixed", r2);
      expect(p1).toEqual(p2);
    }
  });
});
