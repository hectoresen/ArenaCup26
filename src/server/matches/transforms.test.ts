import { describe, expect, it } from "vitest";
import { groupMatchesByDay, utcDayKey } from "./transforms";
import type { MatchListItem } from "./types";

describe("utcDayKey", () => {
  it.each([
    ["2026-06-12T00:00:00Z", "2026-06-12"],
    ["2026-06-12T23:59:59Z", "2026-06-12"],
    ["2026-06-13T00:00:00Z", "2026-06-13"],
    // Local TZ no influye — siempre UTC.
    ["2026-07-09T22:30:00-04:00", "2026-07-10"],
  ] as const)("utcDayKey(%s) → %s", (input, expected) => {
    expect(utcDayKey(new Date(input))).toBe(expected);
  });
});

function buildMatch(kickoffAt: string, id: string): MatchListItem {
  return {
    matchId: id,
    stage: "group",
    kickoffAt: new Date(kickoffAt),
    status: "scheduled",
    homeTeam: { name: "A", flag: null, code: "AAA" },
    awayTeam: { name: "B", flag: null, code: "BBB" },
    homeScore: null,
    awayScore: null,
    prediction: null,
  };
}

describe("groupMatchesByDay", () => {
  it("agrupa varios partidos del mismo día en un único grupo", () => {
    const groups = groupMatchesByDay([
      buildMatch("2026-06-12T15:00:00Z", "a"),
      buildMatch("2026-06-12T19:00:00Z", "b"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.matches).toHaveLength(2);
  });

  it("crea grupos separados por día UTC", () => {
    const groups = groupMatchesByDay([
      buildMatch("2026-06-12T22:00:00Z", "a"),
      buildMatch("2026-06-13T03:00:00Z", "b"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-06-12", "2026-06-13"]);
  });

  it("preserva el orden cronológico del input dentro de cada grupo", () => {
    const groups = groupMatchesByDay([
      buildMatch("2026-06-12T15:00:00Z", "early"),
      buildMatch("2026-06-12T19:00:00Z", "late"),
    ]);
    expect(groups[0]?.matches.map((m) => m.matchId)).toEqual(["early", "late"]);
  });

  it("groups vacíos cuando el input está vacío", () => {
    expect(groupMatchesByDay([])).toEqual([]);
  });
});
