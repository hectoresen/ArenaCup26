import { describe, expect, it } from "vitest";
import { formatPointsEs } from "./number";

describe("formatPointsEs", () => {
  it.each([
    [0, "0"],
    [9, "9"],
    [99, "99"],
    [999, "999"],
    [1000, "1.000"],
    [4820, "4.820"],
    [12345, "12.345"],
    [1000000, "1.000.000"],
  ])("formats %i as %s", (input, expected) => {
    expect(formatPointsEs(input)).toBe(expected);
  });

  it("handles negative numbers", () => {
    expect(formatPointsEs(-4820)).toBe("-4.820");
  });

  it("truncates fractional part (points are always integers)", () => {
    expect(formatPointsEs(4820.7)).toBe("4.820");
  });
});
