import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../types";
import type { MatchDataProvider, ProviderMatch } from "../types";
import { syncFixtures } from "./sync";
import type {
  CurrentMatchRow,
  MatchInsertRow,
  MatchRepo,
  MatchUpdatePatch,
} from "./types";

const TEAM_MAP = new Map([
  ["6", "uuid-arg"],
  ["7", "uuid-fra"],
  ["8", "uuid-bra"],
]);

function buildProvider(snapshots: ProviderMatch[]): MatchDataProvider {
  return {
    name: "test-provider",
    getFixtures: vi.fn(async () => snapshots),
  };
}

function buildSnapshot(overrides: Partial<ProviderMatch> = {}): ProviderMatch {
  return {
    externalId: "fix-1",
    source: "test-provider",
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

/**
 * Repo en memoria. Suficiente para validar el orquestador sin tocar
 * Postgres. La integración real se valida en `sync.integration.test.ts`.
 */
function buildInMemoryRepo(initial: {
  teams?: Map<string, string>;
  matches?: Map<string, string>;
  matchRows?: Map<string, CurrentMatchRow>;
} = {}): MatchRepo & { matchRows: Map<string, CurrentMatchRow>; matchMap: Map<string, string> } {
  const teamMap = initial.teams ?? new Map();
  const matchMap = initial.matches ?? new Map();
  const matchRows = initial.matchRows ?? new Map();
  let nextId = 1;
  return {
    matchMap,
    matchRows,
    loadTeamMap: async () => teamMap,
    loadMatchMap: async () => matchMap,
    loadMatchById: async (id: string) => matchRows.get(id) ?? null,
    insertMatch: async (row: MatchInsertRow, externalId: string) => {
      const id = `inserted-${nextId++}`;
      matchMap.set(externalId, id);
      matchRows.set(id, {
        id,
        status: row.status,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        homeScoreExtra: row.homeScoreExtra,
        awayScoreExtra: row.awayScoreExtra,
        penaltyWinnerTeamId: row.penaltyWinnerTeamId,
        kickoffAt: row.kickoffAt,
      });
      return id;
    },
    updateMatch: async (matchId: string, patch: MatchUpdatePatch) => {
      const existing = matchRows.get(matchId);
      if (!existing) throw new Error(`update on missing row ${matchId}`);
      matchRows.set(matchId, { ...existing, ...patch });
    },
  };
}

describe("syncFixtures", () => {
  it("reports a fresh batch as all inserted", async () => {
    const provider = buildProvider([buildSnapshot(), buildSnapshot({ externalId: "fix-2" })]);
    const repo = buildInMemoryRepo({ teams: TEAM_MAP });

    const report = await syncFixtures({ provider, repo, leagueId: 1, season: 2022 });

    expect(report).toEqual({
      source: "test-provider",
      inserted: 2,
      updated: 0,
      noop: 0,
      skipped: 0,
      errors: [],
    });
    expect(repo.matchRows.size).toBe(2);
  });

  it("running twice in a row produces zero writes the second time (idempotent)", async () => {
    const provider = buildProvider([buildSnapshot()]);
    const repo = buildInMemoryRepo({ teams: TEAM_MAP });

    await syncFixtures({ provider, repo, leagueId: 1, season: 2022 });
    const second = await syncFixtures({ provider, repo, leagueId: 1, season: 2022 });

    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.noop).toBe(1);
  });

  it("updates an existing row when scores change", async () => {
    const initial: CurrentMatchRow = {
      id: "uuid-match-1",
      status: "live",
      homeScore: 1,
      awayScore: 0,
      homeScoreExtra: null,
      awayScoreExtra: null,
      penaltyWinnerTeamId: null,
      kickoffAt: new Date("2022-12-18T15:00:00Z"),
    };
    const repo = buildInMemoryRepo({
      teams: TEAM_MAP,
      matches: new Map([["fix-1", "uuid-match-1"]]),
      matchRows: new Map([["uuid-match-1", initial]]),
    });
    const provider = buildProvider([buildSnapshot()]);

    const report = await syncFixtures({ provider, repo, leagueId: 1, season: 2022 });

    expect(report.updated).toBe(1);
    expect(report.inserted).toBe(0);
    const updated = repo.matchRows.get("uuid-match-1");
    expect(updated?.status).toBe("finished");
    expect(updated?.homeScore).toBe(2);
    expect(updated?.awayScore).toBe(2);
    expect(updated?.penaltyWinnerTeamId).toBe("uuid-arg");
  });

  it("skips a snapshot whose stage is null but processes the rest", async () => {
    const provider = buildProvider([
      buildSnapshot(),
      buildSnapshot({ externalId: "fix-2", stage: null, roundLabel: "Friendly" }),
      buildSnapshot({ externalId: "fix-3" }),
    ]);
    const repo = buildInMemoryRepo({ teams: TEAM_MAP });

    const report = await syncFixtures({ provider, repo, leagueId: 1, season: 2022 });

    expect(report.inserted).toBe(2);
    expect(report.skipped).toBe(1);
    expect(report.errors).toEqual([
      { externalId: "fix-2", reason: "stage_unresolved", detail: "Friendly" },
    ]);
  });

  it("skips a snapshot whose teams aren't mapped", async () => {
    const provider = buildProvider([
      buildSnapshot({
        externalId: "fix-x",
        homeTeam: { externalId: "999", name: "Unknown", code: null, logo: null },
      }),
    ]);
    const repo = buildInMemoryRepo({ teams: TEAM_MAP });

    const report = await syncFixtures({ provider, repo, leagueId: 1, season: 2022 });

    expect(report.inserted).toBe(0);
    expect(report.skipped).toBe(1);
    expect(report.errors[0]).toMatchObject({
      externalId: "fix-x",
      reason: "team_not_mapped",
    });
  });

  it("propagates ProviderError thrown by getFixtures", async () => {
    const provider: MatchDataProvider = {
      name: "test-provider",
      getFixtures: async () => {
        throw new ProviderError("throttled", "test-provider", "rate_limited");
      },
    };
    const repo = buildInMemoryRepo({ teams: TEAM_MAP });

    await expect(syncFixtures({ provider, repo, leagueId: 1, season: 2022 })).rejects.toThrow(
      ProviderError,
    );
  });

  it("captures persistence failures into report.errors without aborting the batch", async () => {
    const provider = buildProvider([
      buildSnapshot({ externalId: "fix-1" }),
      buildSnapshot({ externalId: "fix-2" }),
    ]);
    const repo = buildInMemoryRepo({ teams: TEAM_MAP });
    let calls = 0;
    const originalInsert = repo.insertMatch;
    repo.insertMatch = async (...args) => {
      calls++;
      if (calls === 1) throw new Error("connection lost");
      return originalInsert(...args);
    };

    const report = await syncFixtures({ provider, repo, leagueId: 1, season: 2022 });

    expect(report.inserted).toBe(1);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatchObject({
      externalId: "fix-1",
      reason: "persist_failed",
    });
  });

  it("calls provider.getFixtures with the correct league/season", async () => {
    const provider = buildProvider([]);
    const repo = buildInMemoryRepo({ teams: TEAM_MAP });

    await syncFixtures({ provider, repo, leagueId: 42, season: 2026 });

    expect(provider.getFixtures).toHaveBeenCalledWith({ leagueId: 42, season: 2026 });
  });

  it("inserts within the same batch are visible to subsequent snapshots (matchMap copy is mutated)", async () => {
    // Defensa: si dos snapshots con el mismo externalId aparecen en el lote (no debería
    // pero un provider podría devolverlo dos veces en un edge case), el segundo no
    // intenta insertar de nuevo: encuentra el matchId del primero y va por update.
    const provider = buildProvider([
      buildSnapshot({ externalId: "dup", status: "scheduled", scoreAt90: null, scoreAtExtra: null, penaltyWinner: null }),
      buildSnapshot({ externalId: "dup", status: "live", scoreAt90: null, scoreAtExtra: null, penaltyWinner: null }),
    ]);
    const repo = buildInMemoryRepo({ teams: TEAM_MAP });

    const report = await syncFixtures({ provider, repo, leagueId: 1, season: 2022 });

    expect(report.inserted).toBe(1);
    expect(report.updated).toBe(1);
  });
});
