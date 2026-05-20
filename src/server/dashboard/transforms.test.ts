import { describe, expect, it } from "vitest";
import {
  UPCOMING_LIMIT,
  buildMiniLeaderboard,
  firstName,
  isMatchTBD,
  sortUpcomingMatches,
} from "./transforms";
import type { LeaderboardEntry, UpcomingMatch } from "./types";

describe("firstName", () => {
  it.each([
    ["Carlos Mendoza", "Carlos"],
    ["María José García", "María"],
    ["Layla", "Layla"],
    ["  espacios alrededor  ", "espacios"],
    [null, null],
    [undefined, null],
    ["", null],
    ["   ", null],
  ] as const)("firstName(%s) → %s", (input, expected) => {
    expect(firstName(input)).toBe(expected);
  });
});

function buildUpcoming(overrides: Partial<UpcomingMatch> = {}): UpcomingMatch {
  return {
    matchId: "m1",
    stage: "group",
    kickoffAt: new Date("2026-06-12T15:00:00Z"),
    homeTeam: { name: "Argentina", flag: "🇦🇷", code: "ARG" },
    awayTeam: { name: "México", flag: "🇲🇽", code: "MEX" },
    prediction: null,
    ...overrides,
  };
}

describe("isMatchTBD", () => {
  it("returns true when home team is null", () => {
    expect(isMatchTBD(buildUpcoming({ homeTeam: null }))).toBe(true);
  });

  it("returns true when away team is null", () => {
    expect(isMatchTBD(buildUpcoming({ awayTeam: null }))).toBe(true);
  });

  it("returns false when both teams are present", () => {
    expect(isMatchTBD(buildUpcoming())).toBe(false);
  });
});

describe("sortUpcomingMatches", () => {
  it("sorts by kickoff ASC when no TBD is present", () => {
    const a = buildUpcoming({
      matchId: "later",
      kickoffAt: new Date("2026-06-15T15:00:00Z"),
    });
    const b = buildUpcoming({
      matchId: "earlier",
      kickoffAt: new Date("2026-06-12T15:00:00Z"),
    });
    const sorted = sortUpcomingMatches([a, b]);
    expect(sorted.map((m) => m.matchId)).toEqual(["earlier", "later"]);
  });

  it("pushes TBD matches to the end", () => {
    const tbd = buildUpcoming({
      matchId: "tbd",
      kickoffAt: new Date("2026-06-12T15:00:00Z"),
      homeTeam: null,
    });
    const real = buildUpcoming({
      matchId: "real",
      kickoffAt: new Date("2026-06-14T15:00:00Z"),
    });
    const sorted = sortUpcomingMatches([tbd, real]);
    expect(sorted.map((m) => m.matchId)).toEqual(["real", "tbd"]);
  });

  it("is idempotent (doesn't mutate input)", () => {
    const a = buildUpcoming({ matchId: "a", kickoffAt: new Date("2026-06-15T00:00:00Z") });
    const b = buildUpcoming({ matchId: "b", kickoffAt: new Date("2026-06-12T00:00:00Z") });
    const input = [a, b];
    sortUpcomingMatches(input);
    expect(input.map((m) => m.matchId)).toEqual(["a", "b"]);
  });

  it("preserves order between two TBDs (stable)", () => {
    const tbd1 = buildUpcoming({
      matchId: "tbd1",
      kickoffAt: new Date("2026-07-09T15:00:00Z"),
      homeTeam: null,
    });
    const tbd2 = buildUpcoming({
      matchId: "tbd2",
      kickoffAt: new Date("2026-07-09T19:00:00Z"),
      homeTeam: null,
    });
    const sorted = sortUpcomingMatches([tbd1, tbd2]);
    expect(sorted.map((m) => m.matchId)).toEqual(["tbd1", "tbd2"]);
  });
});

function entry(rank: number, userId: string): LeaderboardEntry {
  return {
    userId,
    name: `user-${userId}`,
    username: `user-${userId}`,
    countryCode: null,
    points: 5000 - rank * 100,
    rank,
    isOnline: false,
  };
}

describe("buildMiniLeaderboard", () => {
  it("returns the top + me when me is outside the top", () => {
    const top = [entry(1, "u1"), entry(2, "u2"), entry(3, "u3")];
    const me = entry(42, "me");
    const view = buildMiniLeaderboard(top, me);
    expect(view.top).toEqual(top);
    expect(view.me).toEqual(me);
  });

  it("hides me when me is already in the top (no duplication)", () => {
    const top = [entry(1, "me"), entry(2, "u2"), entry(3, "u3")];
    const me = entry(1, "me");
    const view = buildMiniLeaderboard(top, me);
    expect(view.me).toBeNull();
  });

  it("returns me=null when caller passes null (anonymous viewer)", () => {
    const top = [entry(1, "u1")];
    const view = buildMiniLeaderboard(top, null);
    expect(view.me).toBeNull();
  });
});

describe("UPCOMING_LIMIT", () => {
  it("is 5 by design (matches the mockup)", () => {
    expect(UPCOMING_LIMIT).toBe(5);
  });
});
