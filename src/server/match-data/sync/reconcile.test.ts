import { describe, expect, it } from "vitest";
import type { ProviderMatch } from "../types";
import { reconcileMatch } from "./reconcile";
import type { CurrentMatchRow, TeamExternalMap } from "./types";

const TEAM_MAP: TeamExternalMap = new Map([
  ["6", "uuid-arg"],
  ["7", "uuid-fra"],
  ["8", "uuid-bra"],
]);

function snapshot(overrides: Partial<ProviderMatch> = {}): ProviderMatch {
  return {
    externalId: "fix-1",
    source: "api-football",
    externalLeagueId: 1,
    externalSeason: 2022,
    roundLabel: "Final",
    stage: "final",
    homeTeam: { externalId: "6", name: "Argentina", code: null, logo: null },
    awayTeam: { externalId: "7", name: "France", code: null, logo: null },
    kickoffAt: new Date("2022-12-18T15:00:00Z"),
    status: "finished",
    scoreAt90: { home: 2, away: 2 },
    scoreAtExtra: { home: 3, away: 3 },
    penaltyWinner: "home",
    fetchedAt: new Date(),
    ...overrides,
  };
}

function currentRow(overrides: Partial<CurrentMatchRow> = {}): CurrentMatchRow {
  return {
    id: "uuid-match",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    homeScoreExtra: null,
    awayScoreExtra: null,
    penaltyWinnerTeamId: null,
    kickoffAt: new Date("2022-12-18T15:00:00Z"),
    ...overrides,
  };
}

describe("reconcileMatch — skip cases", () => {
  it("skips when stage is null (round unresolved)", () => {
    const result = reconcileMatch({
      current: null,
      matchId: null,
      snapshot: snapshot({ stage: null, roundLabel: "Friendly" }),
      teamMap: TEAM_MAP,
    });
    expect(result).toEqual({
      kind: "skip",
      externalId: "fix-1",
      reason: "stage_unresolved",
      detail: "Friendly",
    });
  });

  it("skips when home team is not mapped", () => {
    const result = reconcileMatch({
      current: null,
      matchId: null,
      snapshot: snapshot({
        homeTeam: { externalId: "999", name: "Unknown", code: null, logo: null },
      }),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({ kind: "skip", reason: "team_not_mapped" });
    if (result.kind === "skip") {
      expect(result.detail).toContain("home: 999");
    }
  });

  it("skips when away team is not mapped", () => {
    const result = reconcileMatch({
      current: null,
      matchId: null,
      snapshot: snapshot({
        awayTeam: { externalId: "999", name: "Unknown", code: null, logo: null },
      }),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({ kind: "skip", reason: "team_not_mapped" });
    if (result.kind === "skip") {
      expect(result.detail).toContain("away: 999");
    }
  });

  it("skips a self-match (defensive: home === away after mapping)", () => {
    const sameTeamMap: TeamExternalMap = new Map([["6", "uuid-arg"], ["7", "uuid-arg"]]);
    const result = reconcileMatch({
      current: null,
      matchId: null,
      snapshot: snapshot(),
      teamMap: sameTeamMap,
    });
    expect(result).toMatchObject({ kind: "skip", reason: "self_match" });
  });
});

describe("reconcileMatch — insert cases", () => {
  it("returns insert with all columns when current is null", () => {
    const result = reconcileMatch({
      current: null,
      matchId: null,
      snapshot: snapshot(),
      teamMap: TEAM_MAP,
    });
    expect(result).toEqual({
      kind: "insert",
      externalId: "fix-1",
      row: {
        stage: "final",
        homeTeamId: "uuid-arg",
        awayTeamId: "uuid-fra",
        kickoffAt: new Date("2022-12-18T15:00:00Z"),
        status: "finished",
        homeScore: 2,
        awayScore: 2,
        homeScoreExtra: 3,
        awayScoreExtra: 3,
        penaltyWinnerTeamId: "uuid-arg",
      },
    });
  });

  it("inserts with null scores when match is still scheduled", () => {
    const result = reconcileMatch({
      current: null,
      matchId: null,
      snapshot: snapshot({
        status: "scheduled",
        scoreAt90: null,
        scoreAtExtra: null,
        penaltyWinner: null,
      }),
      teamMap: TEAM_MAP,
    });
    if (result.kind !== "insert") throw new Error(`expected insert, got ${result.kind}`);
    expect(result.row.status).toBe("scheduled");
    expect(result.row.homeScore).toBeNull();
    expect(result.row.awayScore).toBeNull();
    expect(result.row.homeScoreExtra).toBeNull();
    expect(result.row.awayScoreExtra).toBeNull();
    expect(result.row.penaltyWinnerTeamId).toBeNull();
  });

  it("maps penaltyWinner='away' to awayTeamId", () => {
    const result = reconcileMatch({
      current: null,
      matchId: null,
      snapshot: snapshot({ penaltyWinner: "away" }),
      teamMap: TEAM_MAP,
    });
    if (result.kind !== "insert") throw new Error("expected insert");
    expect(result.row.penaltyWinnerTeamId).toBe("uuid-fra");
  });

  it("provider 'live' degrades to db 'live' on insert", () => {
    const result = reconcileMatch({
      current: null,
      matchId: null,
      snapshot: snapshot({ status: "extra_time", scoreAt90: null, scoreAtExtra: null }),
      teamMap: TEAM_MAP,
    });
    if (result.kind !== "insert") throw new Error("expected insert");
    expect(result.row.status).toBe("live");
  });
});

describe("reconcileMatch — update cases", () => {
  it("noops when current row already matches snapshot exactly", () => {
    const result = reconcileMatch({
      current: currentRow({
        status: "finished",
        homeScore: 2,
        awayScore: 2,
        homeScoreExtra: 3,
        awayScoreExtra: 3,
        penaltyWinnerTeamId: "uuid-arg",
      }),
      matchId: "uuid-match",
      snapshot: snapshot(),
      teamMap: TEAM_MAP,
    });
    expect(result).toEqual({ kind: "noop", matchId: "uuid-match" });
  });

  it("patches scoreAt90 when it differs", () => {
    const result = reconcileMatch({
      current: currentRow({ status: "live", homeScore: 1, awayScore: 0 }),
      matchId: "uuid-match",
      snapshot: snapshot({
        status: "finished",
        scoreAt90: { home: 2, away: 0 },
        scoreAtExtra: null,
        penaltyWinner: null,
      }),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({
      kind: "update",
      matchId: "uuid-match",
      patch: { status: "finished", homeScore: 2 },
    });
    if (result.kind === "update") {
      expect(result.patch.awayScore).toBeUndefined();
    }
  });

  it("patches scoreAtExtra when it differs", () => {
    const result = reconcileMatch({
      current: currentRow({
        status: "live",
        homeScore: 2,
        awayScore: 2,
        homeScoreExtra: 2,
        awayScoreExtra: 2,
      }),
      matchId: "uuid-match",
      snapshot: snapshot({
        status: "finished",
        scoreAt90: { home: 2, away: 2 },
        scoreAtExtra: { home: 3, away: 3 },
      }),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({
      kind: "update",
      patch: { homeScoreExtra: 3, awayScoreExtra: 3 },
    });
  });

  it("does not overwrite scores with null (snapshot trae null transitorio)", () => {
    const result = reconcileMatch({
      current: currentRow({
        status: "finished",
        homeScore: 2,
        awayScore: 1,
        homeScoreExtra: null,
        awayScoreExtra: null,
        penaltyWinnerTeamId: null,
      }),
      matchId: "uuid-match",
      snapshot: snapshot({
        status: "finished",
        scoreAt90: null, // <- el provider no entrega scoreAt90 ahora mismo
        scoreAtExtra: null,
        penaltyWinner: null,
      }),
      teamMap: TEAM_MAP,
    });
    // status no cambia, ni scoreAt90 ni nada → noop
    expect(result).toEqual({ kind: "noop", matchId: "uuid-match" });
  });

  it("does not overwrite penaltyWinner when snapshot says null", () => {
    const result = reconcileMatch({
      current: currentRow({
        status: "finished",
        homeScore: 2,
        awayScore: 2,
        homeScoreExtra: 3,
        awayScoreExtra: 3,
        penaltyWinnerTeamId: "uuid-arg",
      }),
      matchId: "uuid-match",
      snapshot: snapshot({ penaltyWinner: null }),
      teamMap: TEAM_MAP,
    });
    expect(result).toEqual({ kind: "noop", matchId: "uuid-match" });
  });

  it("status promotion: scheduled → live", () => {
    const result = reconcileMatch({
      current: currentRow({ status: "scheduled" }),
      matchId: "uuid-match",
      snapshot: snapshot({
        status: "live",
        scoreAt90: null,
        scoreAtExtra: null,
        penaltyWinner: null,
      }),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({
      kind: "update",
      patch: { status: "live" },
    });
  });

  it("status: prediction-locked NEVER goes back to scheduled", () => {
    const result = reconcileMatch({
      current: currentRow({ status: "prediction-locked" }),
      matchId: "uuid-match",
      snapshot: snapshot({
        status: "scheduled",
        scoreAt90: null,
        scoreAtExtra: null,
        penaltyWinner: null,
      }),
      teamMap: TEAM_MAP,
    });
    expect(result).toEqual({ kind: "noop", matchId: "uuid-match" });
  });

  it("status: prediction-locked → live (provider promueve, app no bloquea)", () => {
    const result = reconcileMatch({
      current: currentRow({ status: "prediction-locked" }),
      matchId: "uuid-match",
      snapshot: snapshot({
        status: "live",
        scoreAt90: null,
        scoreAtExtra: null,
        penaltyWinner: null,
      }),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({ kind: "update", patch: { status: "live" } });
  });

  it("status: live → cancelled (provider tiene la última palabra)", () => {
    const result = reconcileMatch({
      current: currentRow({ status: "live", homeScore: 1, awayScore: 0 }),
      matchId: "uuid-match",
      snapshot: snapshot({
        status: "abandoned",
        scoreAt90: null,
        scoreAtExtra: null,
        penaltyWinner: null,
      }),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({
      kind: "update",
      patch: { status: "cancelled" },
    });
    // Y los scores NO se borran: el partido fue real hasta el momento de abandono.
    if (result.kind === "update") {
      expect(result.patch.homeScore).toBeUndefined();
      expect(result.patch.awayScore).toBeUndefined();
    }
  });

  it("kickoffAt change is reflected in patch", () => {
    const result = reconcileMatch({
      current: currentRow({
        status: "scheduled",
        kickoffAt: new Date("2022-12-18T15:00:00Z"),
      }),
      matchId: "uuid-match",
      snapshot: snapshot({
        status: "scheduled",
        kickoffAt: new Date("2022-12-18T18:00:00Z"),
        scoreAt90: null,
        scoreAtExtra: null,
        penaltyWinner: null,
      }),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({
      kind: "update",
      patch: { kickoffAt: new Date("2022-12-18T18:00:00Z") },
    });
  });

  it("penaltyWinner changes from home to away", () => {
    const result = reconcileMatch({
      current: currentRow({
        status: "finished",
        homeScore: 2,
        awayScore: 2,
        homeScoreExtra: 3,
        awayScoreExtra: 3,
        penaltyWinnerTeamId: "uuid-arg",
      }),
      matchId: "uuid-match",
      snapshot: snapshot({ penaltyWinner: "away" }),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({
      kind: "update",
      patch: { penaltyWinnerTeamId: "uuid-fra" },
    });
  });

  it("multiple changes coalesce in a single patch", () => {
    const result = reconcileMatch({
      current: currentRow({
        status: "live",
        homeScore: 1,
        awayScore: 0,
        homeScoreExtra: null,
        awayScoreExtra: null,
        penaltyWinnerTeamId: null,
      }),
      matchId: "uuid-match",
      snapshot: snapshot(),
      teamMap: TEAM_MAP,
    });
    expect(result).toMatchObject({
      kind: "update",
      matchId: "uuid-match",
      patch: {
        status: "finished",
        homeScore: 2,
        awayScore: 2,
        homeScoreExtra: 3,
        awayScoreExtra: 3,
        penaltyWinnerTeamId: "uuid-arg",
      },
    });
  });

  it("throws if current is provided without matchId (orchestrator misuse)", () => {
    expect(() =>
      reconcileMatch({
        current: currentRow(),
        matchId: null,
        snapshot: snapshot(),
        teamMap: TEAM_MAP,
      }),
    ).toThrow(/matchId/);
  });
});
