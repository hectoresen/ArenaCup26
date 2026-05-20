import { describe, expect, it } from "vitest";
import {
  GROUP_DRAW_RAW,
  KO_EXTRA_TIME_HOME_WIN_RAW,
  KO_REGULAR_HOME_WIN_RAW,
  LIVE_2H_RAW,
  POSTPONED_RAW,
  SCHEDULED_RAW,
  WC2022_FINAL_RAW,
} from "./api-football.fixtures";
import { parseApiFootballFixture, parseStage } from "./api-football.parser";

describe("parseStage", () => {
  it.each([
    ["Group A - 1", "group"],
    ["Group F - 3", "group"],
    ["Regular Season - 1", "regular-season"],
    ["Regular Season - 38", "regular-season"],
    ["Round of 16", "round-of-16"],
    ["1/8 Finals", "round-of-16"],
    ["Quarter-finals", "quarter"],
    ["Semi-finals", "semi"],
    ["3rd Place Final", "third-place"],
    ["Third place", "third-place"],
    ["Final", "final"],
  ] as const)("%s → %s", (input, expected) => {
    expect(parseStage(input)).toBe(expected);
  });

  it("returns null for unknown labels", () => {
    expect(parseStage(null)).toBeNull();
    expect(parseStage(undefined)).toBeNull();
    expect(parseStage("")).toBeNull();
    expect(parseStage("Friendly")).toBeNull();
    expect(parseStage("Pre-season")).toBeNull();
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(parseStage("  GROUP B - 1  ")).toBe("group");
    expect(parseStage("FINAL")).toBe("final");
    expect(parseStage("semi-Finals")).toBe("semi");
  });
});

describe("parseApiFootballFixture — WC 2022 final (real shape)", () => {
  const result = parseApiFootballFixture(WC2022_FINAL_RAW, new Date("2026-05-10T00:00:00Z"));

  it("identifies the fixture by externalId and source", () => {
    expect(result.externalId).toBe("979139");
    expect(result.source).toBe("api-football");
  });

  it("extracts league and season identifiers", () => {
    expect(result.externalLeagueId).toBe(1);
    expect(result.externalSeason).toBe(2022);
    expect(result.roundLabel).toBe("Final");
    expect(result.stage).toBe("final");
  });

  it("extracts teams as 'Argentina' and 'France'", () => {
    expect(result.homeTeam.name).toBe("Argentina");
    expect(result.homeTeam.externalId).toBe("26");
    expect(result.awayTeam.name).toBe("France");
    expect(result.awayTeam.externalId).toBe("2");
  });

  it("parses kickoff date", () => {
    expect(result.kickoffAt.toISOString()).toBe("2022-12-18T15:00:00.000Z");
  });

  it("maps PEN status to 'finished'", () => {
    expect(result.status).toBe("finished");
  });

  it("extracts scoreAt90 from score.fulltime", () => {
    expect(result.scoreAt90).toEqual({ home: 2, away: 2 });
  });

  it("computes scoreAtExtra as the cumulative 120' marker (3-3, NOT 1-1 from extratime alone)", () => {
    expect(result.scoreAtExtra).toEqual({ home: 3, away: 3 });
  });

  it("identifies the penalty winner as Argentina (home)", () => {
    expect(result.penaltyWinner).toBe("home");
  });
});

describe("parseApiFootballFixture — knockout decided in extra time (no penalties)", () => {
  const result = parseApiFootballFixture(KO_EXTRA_TIME_HOME_WIN_RAW);

  it("maps AET to 'finished'", () => {
    expect(result.status).toBe("finished");
  });

  it("scoreAt90 reflects the 2-2 fulltime", () => {
    expect(result.scoreAt90).toEqual({ home: 2, away: 2 });
  });

  it("scoreAtExtra reflects the 3-2 cumulative at 120'", () => {
    expect(result.scoreAtExtra).toEqual({ home: 3, away: 2 });
  });

  it("penaltyWinner is null", () => {
    expect(result.penaltyWinner).toBeNull();
  });

  it("stage is 'quarter'", () => {
    expect(result.stage).toBe("quarter");
  });
});

describe("parseApiFootballFixture — knockout decided in regular time", () => {
  const result = parseApiFootballFixture(KO_REGULAR_HOME_WIN_RAW);

  it("scoreAt90 has the final 4-1", () => {
    expect(result.scoreAt90).toEqual({ home: 4, away: 1 });
  });

  it("scoreAtExtra is null because there was no extra time", () => {
    expect(result.scoreAtExtra).toBeNull();
  });

  it("penaltyWinner is null", () => {
    expect(result.penaltyWinner).toBeNull();
  });

  it("stage is 'round-of-16'", () => {
    expect(result.stage).toBe("round-of-16");
  });
});

describe("parseApiFootballFixture — group stage draw", () => {
  const result = parseApiFootballFixture(GROUP_DRAW_RAW);

  it("scoreAt90 reflects the 1-1", () => {
    expect(result.scoreAt90).toEqual({ home: 1, away: 1 });
  });

  it("scoreAtExtra is null (no extra time in group)", () => {
    expect(result.scoreAtExtra).toBeNull();
  });

  it("stage is 'group'", () => {
    expect(result.stage).toBe("group");
  });
});

describe("parseApiFootballFixture — postponed", () => {
  const result = parseApiFootballFixture(POSTPONED_RAW);

  it("status is 'postponed'", () => {
    expect(result.status).toBe("postponed");
  });

  it("all scores are null", () => {
    expect(result.scoreAt90).toBeNull();
    expect(result.scoreAtExtra).toBeNull();
    expect(result.penaltyWinner).toBeNull();
  });
});

describe("parseApiFootballFixture — live 2H", () => {
  const result = parseApiFootballFixture(LIVE_2H_RAW);

  it("status is 'live'", () => {
    expect(result.status).toBe("live");
  });

  // Regresión 2026-05-20: durante el partido, api-football deja
  // `score.fulltime` en null y publica el marcador acumulado en
  // `goals`. Antes leíamos solo `fulltime` y perdíamos el score
  // live; el partido quedaba `live` con score null y la UI mostraba
  // "Britannia - vs - Bodo/Glimt" sin marcador.
  it("scoreAt90 refleja el marcador en vivo desde `goals`", () => {
    expect(result.scoreAt90).toEqual({ home: 2, away: 1 });
  });
});

describe("parseApiFootballFixture — scheduled", () => {
  const result = parseApiFootballFixture(SCHEDULED_RAW);

  it("status is 'scheduled'", () => {
    expect(result.status).toBe("scheduled");
  });

  it("all scores are null", () => {
    expect(result.scoreAt90).toBeNull();
    expect(result.scoreAtExtra).toBeNull();
    expect(result.penaltyWinner).toBeNull();
  });

  it("teams may have placeholder names like 'TBD'", () => {
    expect(result.homeTeam.name).toBe("TBD");
    expect(result.awayTeam.name).toBe("TBD");
  });
});

describe("parseApiFootballFixture — penaltyWinner edge cases", () => {
  it("returns 'away' when the away team won penalties", () => {
    const flipped = {
      ...WC2022_FINAL_RAW,
      score: {
        ...WC2022_FINAL_RAW.score,
        penalty: { home: 2, away: 4 },
      },
    };
    const result = parseApiFootballFixture(flipped);
    expect(result.penaltyWinner).toBe("away");
  });

  it("returns null defensively when penalties are tied (shouldn't happen)", () => {
    const tied = {
      ...WC2022_FINAL_RAW,
      score: {
        ...WC2022_FINAL_RAW.score,
        penalty: { home: 4, away: 4 },
      },
    };
    const result = parseApiFootballFixture(tied);
    expect(result.penaltyWinner).toBeNull();
  });
});
