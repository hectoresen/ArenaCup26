import { scoreMatchPrediction } from "@/server/scoring/engine";
import type { Prediction, PredictionWinner, StreakState } from "@/server/scoring/types";
import { describe, expect, it } from "vitest";
import { WC2022_MATCHES } from "./matches";
import { WC2022_TEAMS } from "./teams";

const NO_STREAK: StreakState = { current: 0, containsDouble: false };

describe("WC2022 teams seed", () => {
  it("contains exactly 32 teams", () => {
    expect(WC2022_TEAMS).toHaveLength(32);
  });

  it("uses unique 3-letter FIFA codes", () => {
    const codes = new Set(WC2022_TEAMS.map((t) => t.code));
    expect(codes.size).toBe(32);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("has non-empty name and flag for each team", () => {
    for (const team of WC2022_TEAMS) {
      expect(team.name.trim().length).toBeGreaterThan(0);
      expect(team.flag.trim().length).toBeGreaterThan(0);
    }
  });

  it("distributes 4 teams per group A through H", () => {
    const byGroup: Record<string, number> = {};
    for (const team of WC2022_TEAMS) {
      byGroup[team.group] = (byGroup[team.group] ?? 0) + 1;
    }
    expect(Object.keys(byGroup).sort()).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    for (const count of Object.values(byGroup)) {
      expect(count).toBe(4);
    }
  });

  it("includes the four iconic finalists", () => {
    const codes = new Set(WC2022_TEAMS.map((t) => t.code));
    for (const required of ["ARG", "FRA", "CRO", "MAR"]) {
      expect(codes).toContain(required);
    }
  });
});

describe("WC2022 matches seed", () => {
  it("includes the full 16 knockout fixture", () => {
    const knockouts = WC2022_MATCHES.filter((m) => m.stage !== "group");
    expect(knockouts).toHaveLength(16);
  });

  it("has the correct count per knockout stage", () => {
    const counts: Record<string, number> = {};
    for (const m of WC2022_MATCHES) {
      counts[m.stage] = (counts[m.stage] ?? 0) + 1;
    }
    expect(counts["round-of-16"]).toBe(8);
    expect(counts.quarter).toBe(4);
    expect(counts.semi).toBe(2);
    expect(counts["third-place"]).toBe(1);
    expect(counts.final).toBe(1);
  });

  it("includes a representative slice of group matches (>= 8)", () => {
    const groupMatches = WC2022_MATCHES.filter((m) => m.stage === "group");
    expect(groupMatches.length).toBeGreaterThanOrEqual(8);
  });

  it("only references known team codes", () => {
    const codes = new Set(WC2022_TEAMS.map((t) => t.code));
    for (const m of WC2022_MATCHES) {
      expect(codes, `home team ${m.homeCode} of ${m.slug}`).toContain(m.homeCode);
      expect(codes, `away team ${m.awayCode} of ${m.slug}`).toContain(m.awayCode);
      if (m.penaltyWinnerCode) {
        expect(codes).toContain(m.penaltyWinnerCode);
        expect([m.homeCode, m.awayCode]).toContain(m.penaltyWinnerCode);
      }
    }
  });

  it("uses unique slugs", () => {
    const slugs = new Set(WC2022_MATCHES.map((m) => m.slug));
    expect(slugs.size).toBe(WC2022_MATCHES.length);
  });

  it("only sets scoreAtExtra in knockout matches", () => {
    for (const m of WC2022_MATCHES) {
      if (m.scoreAtExtra) {
        expect(m.stage, `match ${m.slug} stage`).not.toBe("group");
      }
    }
  });

  it("only sets penaltyWinner when the extra-time score is tied", () => {
    for (const m of WC2022_MATCHES) {
      if (m.penaltyWinnerCode) {
        expect(m.scoreAtExtra, `match ${m.slug} should have scoreAtExtra`).not.toBeNull();
        if (m.scoreAtExtra) {
          expect(
            m.scoreAtExtra.home,
            `${m.slug} extra-time should be tied if penalties were taken`,
          ).toBe(m.scoreAtExtra.away);
        }
      }
    }
  });

  it("captures the iconic Argentina 3-3 France final ending in penalties for ARG", () => {
    const final = WC2022_MATCHES.find((m) => m.stage === "final");
    expect(final).toBeDefined();
    if (!final) return;
    expect([final.homeCode, final.awayCode].sort()).toEqual(["ARG", "FRA"]);
    expect(final.scoreAtExtra).toEqual({ home: 3, away: 3 });
    expect(final.penaltyWinnerCode).toBe("ARG");
  });

  it("captures the Saudi Arabia upset over Argentina in the group stage", () => {
    const upset = WC2022_MATCHES.find((m) => m.slug === "wc2022-grpC-arg-ksa");
    expect(upset).toBeDefined();
    if (!upset) return;
    expect(upset.scoreAt90).toEqual({ home: 1, away: 2 });
  });

  it("captures Croatia's penalty wins over Japan and Brazil", () => {
    const jpnCro = WC2022_MATCHES.find((m) => m.slug === "wc2022-r16-jpn-cro");
    const croBra = WC2022_MATCHES.find((m) => m.slug === "wc2022-qf-cro-bra");
    expect(jpnCro?.penaltyWinnerCode).toBe("CRO");
    expect(croBra?.penaltyWinnerCode).toBe("CRO");
  });
});

describe("WC2022 seed integrates with the scoring engine", () => {
  function actualWinner(match: (typeof WC2022_MATCHES)[number]): PredictionWinner {
    const score = match.scoreAtExtra ?? match.scoreAt90;
    if (score.home > score.away) return "home";
    if (score.away > score.home) return "away";
    if (match.penaltyWinnerCode === match.homeCode) return "home";
    if (match.penaltyWinnerCode === match.awayCode) return "away";
    return "draw";
  }

  it("a perfect 'simple' prediction on every match scores 10 points (no combos in test)", () => {
    for (const match of WC2022_MATCHES) {
      const winner = actualWinner(match);
      const prediction: Prediction = {
        kind: "simple",
        predictedWinner: winner,
        predictedHomeScore: null,
        predictedAwayScore: null,
      };
      const result = scoreMatchPrediction(
        {
          status: "finished",
          stage: match.stage,
          scoreAt90: match.scoreAt90,
          scoreAtExtra: match.scoreAtExtra,
          penaltyWinner:
            match.penaltyWinnerCode === match.homeCode
              ? "home"
              : match.penaltyWinnerCode === match.awayCode
                ? "away"
                : null,
        },
        prediction,
        NO_STREAK,
      );
      expect(result.kind, `${match.slug} should be a simple hit`).toBe("simple");
      expect(result.points, `${match.slug} should score 10`).toBe(10);
    }
  });

  it("a perfect 'exact' prediction matches the exact score (or extra-time score in knockouts)", () => {
    for (const match of WC2022_MATCHES) {
      const score = match.scoreAtExtra ?? match.scoreAt90;
      const prediction: Prediction = {
        kind: "exact",
        predictedWinner: null,
        predictedHomeScore: score.home,
        predictedAwayScore: score.away,
      };
      const result = scoreMatchPrediction(
        {
          status: "finished",
          stage: match.stage,
          scoreAt90: match.scoreAt90,
          scoreAtExtra: match.scoreAtExtra,
          penaltyWinner:
            match.penaltyWinnerCode === match.homeCode
              ? "home"
              : match.penaltyWinnerCode === match.awayCode
                ? "away"
                : null,
        },
        prediction,
        NO_STREAK,
      );
      expect(result.kind, `${match.slug} exact prediction`).toBe("exact");
      expect(result.points).toBe(30);
    }
  });

  it("the final's exact prediction of 3-3 hits because penalties don't move the marker", () => {
    const final = WC2022_MATCHES.find((m) => m.stage === "final");
    expect(final).toBeDefined();
    if (!final) return;

    const result = scoreMatchPrediction(
      {
        status: "finished",
        stage: "final",
        scoreAt90: final.scoreAt90,
        scoreAtExtra: final.scoreAtExtra,
        penaltyWinner:
          final.penaltyWinnerCode === final.homeCode
            ? "home"
            : final.penaltyWinnerCode === final.awayCode
              ? "away"
              : null,
      },
      {
        kind: "exact",
        predictedWinner: null,
        predictedHomeScore: 3,
        predictedAwayScore: 3,
      },
      NO_STREAK,
    );

    expect(result.points).toBe(30);
    expect(result.kind).toBe("exact");
  });
});
