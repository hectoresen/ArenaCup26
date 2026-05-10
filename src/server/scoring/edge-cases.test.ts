import { describe, expect, it } from "vitest";
import { EDGE_CASE_FIXTURES } from "./edge-cases.fixtures";
import { scoreMatchPrediction } from "./engine";

describe("edge-case fixtures", () => {
  it.each(EDGE_CASE_FIXTURES)("$id — $description", (fixture) => {
    const result = scoreMatchPrediction(
      fixture.match,
      fixture.prediction,
      fixture.streakBefore,
    );
    expect(result).toEqual(fixture.expected);
  });

  it("covers a representative breadth of scenarios", () => {
    // Sanity check para que nadie borre fixtures sin querer.
    expect(EDGE_CASE_FIXTURES.length).toBeGreaterThanOrEqual(15);
    const ids = new Set(EDGE_CASE_FIXTURES.map((f) => f.id));
    expect(ids.size).toBe(EDGE_CASE_FIXTURES.length); // todos los IDs son únicos
  });

  it("includes group, knockout, voided and combo scenarios", () => {
    const stages = new Set(EDGE_CASE_FIXTURES.map((f) => f.match.stage));
    expect(stages.has("group")).toBe(true);
    expect(
      [...stages].some((s) => s === "round-of-16" || s === "quarter" || s === "semi" || s === "final"),
    ).toBe(true);

    const kinds = new Set(EDGE_CASE_FIXTURES.map((f) => f.expected.kind));
    expect(kinds.has("simple")).toBe(true);
    expect(kinds.has("exact")).toBe(true);
    expect(kinds.has("double")).toBe(true);
    expect(kinds.has("miss")).toBe(true);
    expect(kinds.has("voided")).toBe(true);

    const hasComboBonus = EDGE_CASE_FIXTURES.some((f) => f.expected.comboBonuses.length > 0);
    expect(hasComboBonus).toBe(true);
  });
});
