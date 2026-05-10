import { describe, expect, it } from "vitest";
import { scoreMatchPrediction } from "./engine";
import type { MatchOutcome, Prediction, StreakState } from "./types";

// ──────────────────────────────────────────────────────────────────────
// Helpers para construir inputs sin verbosidad
// ──────────────────────────────────────────────────────────────────────

function group(home: number, away: number): MatchOutcome {
  return {
    status: "finished",
    stage: "group",
    scoreAt90: { home, away },
    scoreAtExtra: null,
    penaltyWinner: null,
  };
}

function knockout(opts: {
  at90?: { home: number; away: number };
  atExtra?: { home: number; away: number };
  penaltyWinner?: "home" | "away";
  stage?: MatchOutcome["stage"];
}): MatchOutcome {
  return {
    status: "finished",
    stage: opts.stage ?? "round-of-16",
    scoreAt90: opts.at90 ?? null,
    scoreAtExtra: opts.atExtra ?? null,
    penaltyWinner: opts.penaltyWinner ?? null,
  };
}

function simple(winner: "home" | "away" | "draw"): Prediction {
  return {
    kind: "simple",
    predictedWinner: winner,
    predictedHomeScore: null,
    predictedAwayScore: null,
  };
}

function exact(home: number, away: number): Prediction {
  return {
    kind: "exact",
    predictedWinner: null,
    predictedHomeScore: home,
    predictedAwayScore: away,
  };
}

function dbl(kind: "1x" | "x2" | "12"): Prediction {
  return {
    kind: `double-${kind}` as Prediction["kind"],
    predictedWinner: null,
    predictedHomeScore: null,
    predictedAwayScore: null,
  };
}

const NO_STREAK: StreakState = { current: 0, containsDouble: false };

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

describe("scoreMatchPrediction", () => {
  // ────────────────────────── ESTADOS ANULADOS ──────────────────────────

  describe("status edge cases", () => {
    it("returns voided when match is cancelled, preserving streak", () => {
      const result = scoreMatchPrediction(
        {
          status: "cancelled",
          stage: "group",
          scoreAt90: null,
          scoreAtExtra: null,
          penaltyWinner: null,
        },
        simple("home"),
        { current: 5, containsDouble: false },
      );
      expect(result.points).toBe(0);
      expect(result.kind).toBe("voided");
      expect(result.streakAfter).toEqual({ current: 5, containsDouble: false });
      expect(result.comboBonuses).toEqual([]);
    });

    it("returns voided when match is postponed, preserving streak with double flag", () => {
      const result = scoreMatchPrediction(
        {
          status: "postponed",
          stage: "group",
          scoreAt90: null,
          scoreAtExtra: null,
          penaltyWinner: null,
        },
        simple("home"),
        { current: 3, containsDouble: true },
      );
      expect(result.kind).toBe("voided");
      expect(result.streakAfter).toEqual({ current: 3, containsDouble: true });
    });

    it("returns voided defensively when status is finished but scores are missing", () => {
      const result = scoreMatchPrediction(
        {
          status: "finished",
          stage: "group",
          scoreAt90: null,
          scoreAtExtra: null,
          penaltyWinner: null,
        },
        simple("home"),
        NO_STREAK,
      );
      expect(result.kind).toBe("voided");
      expect(result.streakAfter).toEqual(NO_STREAK);
    });

    it("treats live status as voided (engine should only run for finished/cancelled)", () => {
      const result = scoreMatchPrediction(
        {
          status: "live",
          stage: "group",
          scoreAt90: { home: 1, away: 0 },
          scoreAtExtra: null,
          penaltyWinner: null,
        },
        simple("home"),
        { current: 2, containsDouble: false },
      );
      expect(result.kind).toBe("voided");
      expect(result.streakAfter.current).toBe(2);
    });
  });

  // ─────────────────────── GRUPOS · SIMPLE ──────────────────────────────

  describe("group stage simple predictions", () => {
    it("hits when predicted home and home wins", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), NO_STREAK);
      expect(result.points).toBe(10);
      expect(result.kind).toBe("simple");
      expect(result.streakAfter).toEqual({ current: 1, containsDouble: false });
    });

    it("hits when predicted away and away wins", () => {
      const result = scoreMatchPrediction(group(0, 2), simple("away"), NO_STREAK);
      expect(result.points).toBe(10);
    });

    it("hits when predicted draw and draw happens", () => {
      const result = scoreMatchPrediction(group(1, 1), simple("draw"), NO_STREAK);
      expect(result.points).toBe(10);
    });

    it("misses when predicted home and draw happens", () => {
      const result = scoreMatchPrediction(group(1, 1), simple("home"), {
        current: 4,
        containsDouble: false,
      });
      expect(result.kind).toBe("miss");
      expect(result.points).toBe(0);
      expect(result.streakAfter).toEqual({ current: 0, containsDouble: false });
    });

    it("misses when predicted home and away wins", () => {
      const result = scoreMatchPrediction(group(0, 2), simple("home"), NO_STREAK);
      expect(result.kind).toBe("miss");
    });

    it("misses defensively if predictedWinner is null", () => {
      const pred: Prediction = {
        kind: "simple",
        predictedWinner: null,
        predictedHomeScore: null,
        predictedAwayScore: null,
      };
      const result = scoreMatchPrediction(group(2, 1), pred, NO_STREAK);
      expect(result.kind).toBe("miss");
    });
  });

  // ─────────────────────── GRUPOS · EXACTO ──────────────────────────────

  describe("group stage exact predictions", () => {
    it("hits when score matches exactly", () => {
      const result = scoreMatchPrediction(group(2, 1), exact(2, 1), NO_STREAK);
      expect(result.points).toBe(30);
      expect(result.kind).toBe("exact");
    });

    it("misses when scores are flipped (got total, wrong distribution)", () => {
      const result = scoreMatchPrediction(group(2, 1), exact(1, 2), NO_STREAK);
      expect(result.kind).toBe("miss");
    });

    it("does not fall back to simple when total is right but distribution wrong", () => {
      const result = scoreMatchPrediction(group(3, 0), exact(2, 1), NO_STREAK);
      expect(result.kind).toBe("miss");
      expect(result.points).toBe(0);
    });

    it("hits 0-0 when predicted 0-0", () => {
      const result = scoreMatchPrediction(group(0, 0), exact(0, 0), NO_STREAK);
      expect(result.points).toBe(30);
    });

    it("misses defensively when predicted scores are null", () => {
      const pred: Prediction = {
        kind: "exact",
        predictedWinner: null,
        predictedHomeScore: null,
        predictedAwayScore: null,
      };
      const result = scoreMatchPrediction(group(2, 1), pred, NO_STREAK);
      expect(result.kind).toBe("miss");
    });
  });

  // ─────────────────────── GRUPOS · DOBLES ──────────────────────────────

  describe("group stage double predictions", () => {
    it.each([
      ["1x", 2, 0, true, "home wins → 1X covers"],
      ["1x", 1, 1, true, "draw → 1X covers"],
      ["1x", 0, 2, false, "away wins → 1X miss"],
      ["x2", 1, 1, true, "draw → X2 covers"],
      ["x2", 0, 2, true, "away wins → X2 covers"],
      ["x2", 2, 0, false, "home wins → X2 miss"],
      ["12", 2, 0, true, "home wins → 12 covers"],
      ["12", 0, 2, true, "away wins → 12 covers"],
      ["12", 1, 1, false, "draw → 12 miss"],
    ] as const)(
      "double-%s on %d-%d → %s (%s)",
      (kind, home, away, hits, _label) => {
        const result = scoreMatchPrediction(group(home, away), dbl(kind), NO_STREAK);
        if (hits) {
          expect(result.points).toBe(5);
          expect(result.kind).toBe("double");
          expect(result.streakAfter).toEqual({ current: 1, containsDouble: true });
        } else {
          expect(result.kind).toBe("miss");
          expect(result.points).toBe(0);
          expect(result.streakAfter).toEqual({ current: 0, containsDouble: false });
        }
      },
    );
  });

  // ─────────────────────── ELIMINATORIA · SIMPLE ────────────────────────

  describe("knockout simple predictions", () => {
    it("hits when home wins outright in 90'", () => {
      const result = scoreMatchPrediction(
        knockout({ at90: { home: 2, away: 1 } }),
        simple("home"),
        NO_STREAK,
      );
      expect(result.points).toBe(10);
    });

    it("misses when 'draw' is predicted (no official draw in knockout)", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 1 },
          penaltyWinner: "home",
        }),
        simple("draw"),
        NO_STREAK,
      );
      expect(result.kind).toBe("miss");
    });

    it("uses extra-time winner when home scores in extra time", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 2, away: 1 },
        }),
        simple("home"),
        NO_STREAK,
      );
      expect(result.points).toBe(10);
    });

    it("uses penalty winner when extra time also ends tied", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 1 },
          penaltyWinner: "away",
        }),
        simple("away"),
        NO_STREAK,
      );
      expect(result.points).toBe(10);
    });

    it("home prediction misses when team loses in extra time", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 2 },
        }),
        simple("home"),
        NO_STREAK,
      );
      expect(result.kind).toBe("miss");
    });

    it("home prediction misses when team loses on penalties", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 1 },
          penaltyWinner: "away",
        }),
        simple("home"),
        NO_STREAK,
      );
      expect(result.kind).toBe("miss");
    });
  });

  // ─────────────────────── ELIMINATORIA · EXACTO ────────────────────────

  describe("knockout exact predictions", () => {
    it("hits when extra-time score matches the prediction", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 2, away: 1 },
        }),
        exact(2, 1),
        NO_STREAK,
      );
      expect(result.points).toBe(30);
    });

    it("misses when prediction matches the 90' score but not the extra-time score", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 2, away: 1 },
        }),
        exact(1, 1),
        NO_STREAK,
      );
      expect(result.kind).toBe("miss");
    });

    it("hits 1-1 prediction when penalties decide a 1-1 draw at the end of extra time", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 1 },
          penaltyWinner: "home",
        }),
        exact(1, 1),
        NO_STREAK,
      );
      expect(result.points).toBe(30);
    });

    it("misses 2-1 exact when actual was 1-1 + penalties (penalties don't change marker)", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 1 },
          penaltyWinner: "home",
        }),
        exact(2, 1),
        NO_STREAK,
      );
      expect(result.kind).toBe("miss");
    });

    it("hits 2-2 exact in a 2-2 + penalties knockout", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 2, away: 2 },
          atExtra: { home: 2, away: 2 },
          penaltyWinner: "away",
        }),
        exact(2, 2),
        NO_STREAK,
      );
      expect(result.points).toBe(30);
    });
  });

  // ─────────────────────── ELIMINATORIA · DOBLES ────────────────────────

  describe("knockout double predictions", () => {
    it("double-12 always hits when there is an official winner (home outright)", () => {
      const result = scoreMatchPrediction(
        knockout({ at90: { home: 2, away: 0 } }),
        dbl("12"),
        NO_STREAK,
      );
      expect(result.points).toBe(5);
    });

    it("double-12 hits when away wins via penalties", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 1 },
          penaltyWinner: "away",
        }),
        dbl("12"),
        NO_STREAK,
      );
      expect(result.points).toBe(5);
    });

    it("double-1x in knockout misses when away wins (no draw possible officially)", () => {
      const result = scoreMatchPrediction(
        knockout({ at90: { home: 0, away: 2 } }),
        dbl("1x"),
        NO_STREAK,
      );
      expect(result.kind).toBe("miss");
    });

    it("double-1x hits when home wins via penalties (covers 'home' winner)", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 1 },
          penaltyWinner: "home",
        }),
        dbl("1x"),
        NO_STREAK,
      );
      expect(result.points).toBe(5);
    });

    it("double-x2 hits when away wins via penalties", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 0, away: 0 },
          atExtra: { home: 0, away: 0 },
          penaltyWinner: "away",
        }),
        dbl("x2"),
        NO_STREAK,
      );
      expect(result.points).toBe(5);
    });
  });

  // ─────────────────────── COMBOS · HITOS ───────────────────────────────

  describe("combo bonuses (base, no doubles in streak)", () => {
    it("no combo on streak 0 → 1", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), NO_STREAK);
      expect(result.comboBonuses).toEqual([]);
    });

    it("no combo on streak 1 → 2", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), {
        current: 1,
        containsDouble: false,
      });
      expect(result.comboBonuses).toEqual([]);
    });

    it("awards +5 when streak crosses milestone 3", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), {
        current: 2,
        containsDouble: false,
      });
      expect(result.points).toBe(10 + 5);
      expect(result.comboBonuses).toEqual([{ milestone: 3, points: 5 }]);
      expect(result.streakAfter.current).toBe(3);
    });

    it("no combo on 3 → 4", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), {
        current: 3,
        containsDouble: false,
      });
      expect(result.comboBonuses).toEqual([]);
    });

    it("awards +15 when streak crosses milestone 5", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), {
        current: 4,
        containsDouble: false,
      });
      expect(result.points).toBe(10 + 15);
      expect(result.comboBonuses).toEqual([{ milestone: 5, points: 15 }]);
    });

    it("no combo between 5 and 10", () => {
      for (const current of [5, 6, 7, 8] as const) {
        const result = scoreMatchPrediction(group(2, 1), simple("home"), {
          current,
          containsDouble: false,
        });
        expect(result.comboBonuses).toEqual([]);
      }
    });

    it("awards +50 when streak crosses milestone 10", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), {
        current: 9,
        containsDouble: false,
      });
      expect(result.points).toBe(10 + 50);
      expect(result.comboBonuses).toEqual([{ milestone: 10, points: 50 }]);
    });

    it("no combo past 10", () => {
      for (const current of [10, 11, 15, 20] as const) {
        const result = scoreMatchPrediction(group(2, 1), simple("home"), {
          current,
          containsDouble: false,
        });
        expect(result.comboBonuses).toEqual([]);
        expect(result.points).toBe(10);
      }
    });
  });

  describe("combo bonuses (modified, streak contains double)", () => {
    it("awards +3 when crossing milestone 3 with prior double in streak", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), {
        current: 2,
        containsDouble: true,
      });
      expect(result.points).toBe(10 + 3);
      expect(result.comboBonuses).toEqual([{ milestone: 3, points: 3 }]);
    });

    it("awards +5 when crossing milestone 5 with prior double", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), {
        current: 4,
        containsDouble: true,
      });
      expect(result.points).toBe(10 + 5);
      expect(result.comboBonuses).toEqual([{ milestone: 5, points: 5 }]);
    });

    it("awards +9 when crossing milestone 10 with prior double", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), {
        current: 9,
        containsDouble: true,
      });
      expect(result.points).toBe(10 + 9);
      expect(result.comboBonuses).toEqual([{ milestone: 10, points: 9 }]);
    });
  });

  // ─────────────────────── RACHA · TRANSICIONES ─────────────────────────

  describe("streak transitions", () => {
    it("resets streak completely on miss", () => {
      const result = scoreMatchPrediction(group(0, 2), simple("home"), {
        current: 7,
        containsDouble: true,
      });
      expect(result.streakAfter).toEqual({ current: 0, containsDouble: false });
    });

    it("preserves streak on cancelled match", () => {
      const result = scoreMatchPrediction(
        {
          status: "cancelled",
          stage: "group",
          scoreAt90: null,
          scoreAtExtra: null,
          penaltyWinner: null,
        },
        simple("home"),
        { current: 7, containsDouble: true },
      );
      expect(result.streakAfter).toEqual({ current: 7, containsDouble: true });
    });

    it("turns containsDouble on when current hit is a double", () => {
      const result = scoreMatchPrediction(group(2, 0), dbl("1x"), {
        current: 0,
        containsDouble: false,
      });
      expect(result.streakAfter).toEqual({ current: 1, containsDouble: true });
    });

    it("preserves containsDouble true through subsequent simple hits", () => {
      const result = scoreMatchPrediction(group(2, 1), simple("home"), {
        current: 3,
        containsDouble: true,
      });
      expect(result.streakAfter.containsDouble).toBe(true);
    });

    it("flips containsDouble to true when a double lands on a clean streak", () => {
      const result = scoreMatchPrediction(group(2, 0), dbl("1x"), {
        current: 3,
        containsDouble: false,
      });
      expect(result.streakAfter).toEqual({ current: 4, containsDouble: true });
    });

    it("clears containsDouble after a miss (full reset)", () => {
      const result = scoreMatchPrediction(group(0, 1), simple("home"), {
        current: 3,
        containsDouble: true,
      });
      expect(result.streakAfter).toEqual({ current: 0, containsDouble: false });
    });
  });

  // ─────────────────────── INTEGRACIÓN ──────────────────────────────────

  describe("integration scenarios", () => {
    it("scoring a double at streak 2 reaches milestone 3 with modified bonus", () => {
      const result = scoreMatchPrediction(group(2, 0), dbl("1x"), {
        current: 2,
        containsDouble: false,
      });
      // Hit is double (+5) AND the streak crosses to 3 with double now in it (+3)
      expect(result.points).toBe(5 + 3);
      expect(result.kind).toBe("double");
      expect(result.streakAfter).toEqual({ current: 3, containsDouble: true });
      expect(result.comboBonuses).toEqual([{ milestone: 3, points: 3 }]);
    });

    it("scoring an exact at streak 9 reaches milestone 10 with base bonus", () => {
      const result = scoreMatchPrediction(group(2, 1), exact(2, 1), {
        current: 9,
        containsDouble: false,
      });
      expect(result.points).toBe(30 + 50);
      expect(result.kind).toBe("exact");
      expect(result.streakAfter).toEqual({ current: 10, containsDouble: false });
      expect(result.comboBonuses).toEqual([{ milestone: 10, points: 50 }]);
    });

    it("scoring an exact at streak 9 with prior double awards modified +9", () => {
      const result = scoreMatchPrediction(group(2, 1), exact(2, 1), {
        current: 9,
        containsDouble: true,
      });
      expect(result.points).toBe(30 + 9);
    });

    it("scoring a knockout simple win at streak 4 reaches milestone 5 with base bonus", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 1 },
          penaltyWinner: "home",
        }),
        simple("home"),
        { current: 4, containsDouble: false },
      );
      expect(result.points).toBe(10 + 15);
      expect(result.streakAfter).toEqual({ current: 5, containsDouble: false });
    });

    it("missing a knockout draw prediction at streak 7 resets the streak", () => {
      const result = scoreMatchPrediction(
        knockout({
          at90: { home: 1, away: 1 },
          atExtra: { home: 1, away: 1 },
          penaltyWinner: "home",
        }),
        simple("draw"),
        { current: 7, containsDouble: true },
      );
      expect(result.kind).toBe("miss");
      expect(result.streakAfter).toEqual({ current: 0, containsDouble: false });
    });
  });
});
