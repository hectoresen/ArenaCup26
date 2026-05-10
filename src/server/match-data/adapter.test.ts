import { describe, expect, it } from "vitest";
import { scoreMatchPrediction } from "@/server/scoring/engine";
import type { Prediction, StreakState } from "@/server/scoring/types";
import { toMatchOutcome } from "./adapter";
import { parseApiFootballFixture } from "./providers/api-football.parser";
import { WC2022_FINAL_RAW } from "./providers/api-football.fixtures";
import type { ProviderMatch } from "./types";

const NO_STREAK: StreakState = { current: 0, containsDouble: false };

function baseProviderMatch(overrides: Partial<ProviderMatch> = {}): ProviderMatch {
  return {
    externalId: "test-1",
    source: "test",
    externalLeagueId: 1,
    externalSeason: 2022,
    roundLabel: "Group A - 1",
    stage: "group",
    homeTeam: { externalId: "1", name: "Home", code: null, logo: null },
    awayTeam: { externalId: "2", name: "Away", code: null, logo: null },
    kickoffAt: new Date("2022-11-20T16:00:00Z"),
    status: "finished",
    scoreAt90: { home: 2, away: 1 },
    scoreAtExtra: null,
    penaltyWinner: null,
    fetchedAt: new Date(),
    ...overrides,
  };
}

describe("toMatchOutcome", () => {
  it("converts a finished group match into a MatchOutcome", () => {
    const outcome = toMatchOutcome(baseProviderMatch());
    expect(outcome).toEqual({
      status: "finished",
      stage: "group",
      scoreAt90: { home: 2, away: 1 },
      scoreAtExtra: null,
      penaltyWinner: null,
    });
  });

  it.each([
    ["scheduled", "scheduled"],
    ["live", "live"],
    ["extra_time", "live"],
    ["penalty_shootout", "live"],
    ["finished", "finished"],
    ["postponed", "postponed"],
    ["cancelled", "cancelled"],
    ["abandoned", "cancelled"],
    ["interrupted", "live"],
    ["unknown", "scheduled"],
  ] as const)("maps provider status %s → match status %s", (providerStatus, expected) => {
    const outcome = toMatchOutcome(baseProviderMatch({ status: providerStatus }));
    expect(outcome.status).toBe(expected);
  });

  it("preserves scoreAt90, scoreAtExtra and penaltyWinner verbatim", () => {
    const outcome = toMatchOutcome(
      baseProviderMatch({
        stage: "final",
        scoreAt90: { home: 2, away: 2 },
        scoreAtExtra: { home: 3, away: 3 },
        penaltyWinner: "home",
      }),
    );
    expect(outcome.scoreAt90).toEqual({ home: 2, away: 2 });
    expect(outcome.scoreAtExtra).toEqual({ home: 3, away: 3 });
    expect(outcome.penaltyWinner).toBe("home");
  });

  it("throws when stage is null (provider couldn't classify the round)", () => {
    expect(() => toMatchOutcome(baseProviderMatch({ stage: null, roundLabel: "Friendly" }))).toThrow(
      /stage is null/,
    );
  });
});

describe("end-to-end: api-football fixture → ProviderMatch → MatchOutcome → scoring engine", () => {
  it("the WC 2022 final lands as a 'finished' MatchOutcome with the expected scores", () => {
    const providerMatch = parseApiFootballFixture(WC2022_FINAL_RAW);
    const outcome = toMatchOutcome(providerMatch);

    expect(outcome).toEqual({
      status: "finished",
      stage: "final",
      scoreAt90: { home: 2, away: 2 },
      scoreAtExtra: { home: 3, away: 3 },
      penaltyWinner: "home",
    });
  });

  it("a perfect 'simple home' prediction on the WC 2022 final scores 10 (Argentina = home, won via penalties)", () => {
    const outcome = toMatchOutcome(parseApiFootballFixture(WC2022_FINAL_RAW));
    const prediction: Prediction = {
      kind: "simple",
      predictedWinner: "home",
      predictedHomeScore: null,
      predictedAwayScore: null,
    };
    const result = scoreMatchPrediction(outcome, prediction, NO_STREAK);
    expect(result.points).toBe(10);
    expect(result.kind).toBe("simple");
  });

  it("a perfect 'exact 3-3' prediction on the WC 2022 final scores 30 (penaltis no mueven el marcador)", () => {
    const outcome = toMatchOutcome(parseApiFootballFixture(WC2022_FINAL_RAW));
    const prediction: Prediction = {
      kind: "exact",
      predictedWinner: null,
      predictedHomeScore: 3,
      predictedAwayScore: 3,
    };
    const result = scoreMatchPrediction(outcome, prediction, NO_STREAK);
    expect(result.points).toBe(30);
    expect(result.kind).toBe("exact");
  });

  it("a 'simple draw' prediction on the WC 2022 final misses (no draw in knockouts)", () => {
    const outcome = toMatchOutcome(parseApiFootballFixture(WC2022_FINAL_RAW));
    const prediction: Prediction = {
      kind: "simple",
      predictedWinner: "draw",
      predictedHomeScore: null,
      predictedAwayScore: null,
    };
    const result = scoreMatchPrediction(outcome, prediction, NO_STREAK);
    expect(result.kind).toBe("miss");
  });
});
