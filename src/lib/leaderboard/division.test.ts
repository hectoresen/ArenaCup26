import { describe, expect, it } from "vitest";
import { DIVISION_MAX_RANK, getDivisionForRank } from "./division";

describe("getDivisionForRank", () => {
  it("returns 'gold' for ranks 1-10", () => {
    expect(getDivisionForRank(1)).toBe("gold");
    expect(getDivisionForRank(5)).toBe("gold");
    expect(getDivisionForRank(10)).toBe("gold");
  });

  it("returns 'silver' for ranks 11-20", () => {
    expect(getDivisionForRank(11)).toBe("silver");
    expect(getDivisionForRank(15)).toBe("silver");
    expect(getDivisionForRank(20)).toBe("silver");
  });

  it("returns 'bronze' for ranks 21-30", () => {
    expect(getDivisionForRank(21)).toBe("bronze");
    expect(getDivisionForRank(25)).toBe("bronze");
    expect(getDivisionForRank(30)).toBe("bronze");
  });

  it("returns null for ranks beyond 30 (no medal)", () => {
    expect(getDivisionForRank(31)).toBeNull();
    expect(getDivisionForRank(100)).toBeNull();
    expect(getDivisionForRank(10_000)).toBeNull();
  });

  it("returns null for invalid inputs (defensive)", () => {
    expect(getDivisionForRank(null)).toBeNull();
    expect(getDivisionForRank(undefined)).toBeNull();
    expect(getDivisionForRank(0)).toBeNull();
    expect(getDivisionForRank(-1)).toBeNull();
  });

  it("DIVISION_MAX_RANK matches the boundaries used by the function", () => {
    expect(DIVISION_MAX_RANK).toEqual({ gold: 10, silver: 20, bronze: 30 });
    expect(getDivisionForRank(DIVISION_MAX_RANK.gold)).toBe("gold");
    expect(getDivisionForRank(DIVISION_MAX_RANK.silver)).toBe("silver");
    expect(getDivisionForRank(DIVISION_MAX_RANK.bronze)).toBe("bronze");
  });
});
