import { describe, expect, it } from "vitest";
import { allowedKindsForStage, isPredictionWindowOpen, validatePrediction } from "./rules";

describe("allowedKindsForStage", () => {
  it("group permits all 5 kinds", () => {
    expect([...allowedKindsForStage("group")]).toEqual([
      "simple",
      "exact",
      "double-1x",
      "double-x2",
      "double-12",
    ]);
  });

  it.each(["round-of-16", "quarter", "semi", "third-place", "final"] as const)(
    "%s permits only simple + exact",
    (stage) => {
      expect([...allowedKindsForStage(stage)]).toEqual(["simple", "exact"]);
    },
  );
});

describe("validatePrediction — kind gating", () => {
  it("rejects double in knockout", () => {
    const r = validatePrediction(
      {
        kind: "double-1x",
        predictedWinner: null,
        predictedHomeScore: null,
        predictedAwayScore: null,
      },
      "semi",
    );
    expect(r).toEqual({ ok: false, code: "kind_not_allowed_for_stage" });
  });
});

describe("validatePrediction — simple", () => {
  it("requires winner", () => {
    const r = validatePrediction(
      {
        kind: "simple",
        predictedWinner: null,
        predictedHomeScore: null,
        predictedAwayScore: null,
      },
      "group",
    );
    expect(r).toEqual({ ok: false, code: "simple_missing_winner" });
  });

  it("permits draw in group", () => {
    const r = validatePrediction(
      {
        kind: "simple",
        predictedWinner: "draw",
        predictedHomeScore: null,
        predictedAwayScore: null,
      },
      "group",
    );
    expect(r).toEqual({ ok: true });
  });

  it("rejects draw in knockout", () => {
    const r = validatePrediction(
      {
        kind: "simple",
        predictedWinner: "draw",
        predictedHomeScore: null,
        predictedAwayScore: null,
      },
      "final",
    );
    expect(r).toEqual({ ok: false, code: "simple_draw_in_knockout" });
  });

  it.each(["home", "away"] as const)("permits %s as winner in any stage", (w) => {
    expect(
      validatePrediction(
        {
          kind: "simple",
          predictedWinner: w,
          predictedHomeScore: null,
          predictedAwayScore: null,
        },
        "final",
      ),
    ).toEqual({ ok: true });
  });
});

describe("validatePrediction — exact", () => {
  it("requires both scores", () => {
    expect(
      validatePrediction(
        {
          kind: "exact",
          predictedWinner: null,
          predictedHomeScore: 2,
          predictedAwayScore: null,
        },
        "group",
      ),
    ).toEqual({ ok: false, code: "exact_missing_scores" });
  });

  it("rejects negative scores", () => {
    expect(
      validatePrediction(
        {
          kind: "exact",
          predictedWinner: null,
          predictedHomeScore: 2,
          predictedAwayScore: -1,
        },
        "group",
      ),
    ).toEqual({ ok: false, code: "exact_negative_scores" });
  });

  it("rejects unreasonable scores > 20", () => {
    expect(
      validatePrediction(
        {
          kind: "exact",
          predictedWinner: null,
          predictedHomeScore: 25,
          predictedAwayScore: 0,
        },
        "group",
      ),
    ).toEqual({ ok: false, code: "exact_unreasonable_scores" });
  });

  it("accepts 0-0", () => {
    expect(
      validatePrediction(
        {
          kind: "exact",
          predictedWinner: null,
          predictedHomeScore: 0,
          predictedAwayScore: 0,
        },
        "group",
      ),
    ).toEqual({ ok: true });
  });

  it("accepts 3-2 in knockout", () => {
    expect(
      validatePrediction(
        {
          kind: "exact",
          predictedWinner: null,
          predictedHomeScore: 3,
          predictedAwayScore: 2,
        },
        "final",
      ),
    ).toEqual({ ok: true });
  });
});

describe("validatePrediction — doubles", () => {
  it.each(["double-1x", "double-x2", "double-12"] as const)("%s with no extras passes", (kind) => {
    expect(
      validatePrediction(
        {
          kind,
          predictedWinner: null,
          predictedHomeScore: null,
          predictedAwayScore: null,
        },
        "group",
      ),
    ).toEqual({ ok: true });
  });

  it("rejects double with stray winner", () => {
    expect(
      validatePrediction(
        {
          kind: "double-1x",
          predictedWinner: "home",
          predictedHomeScore: null,
          predictedAwayScore: null,
        },
        "group",
      ),
    ).toEqual({ ok: false, code: "double_has_winner_or_scores" });
  });

  it("rejects double with stray scores", () => {
    expect(
      validatePrediction(
        {
          kind: "double-x2",
          predictedWinner: null,
          predictedHomeScore: 2,
          predictedAwayScore: 1,
        },
        "group",
      ),
    ).toEqual({ ok: false, code: "double_has_winner_or_scores" });
  });
});

describe("isPredictionWindowOpen", () => {
  const NOW = new Date("2026-06-12T10:00:00Z");

  it("returns true when kickoff is in the future", () => {
    expect(isPredictionWindowOpen(new Date("2026-06-12T15:00:00Z"), NOW)).toBe(true);
  });

  it("returns false at the exact kickoff moment", () => {
    expect(isPredictionWindowOpen(NOW, NOW)).toBe(false);
  });

  it("returns false after kickoff", () => {
    expect(isPredictionWindowOpen(new Date("2026-06-12T09:59:59Z"), NOW)).toBe(false);
  });
});
