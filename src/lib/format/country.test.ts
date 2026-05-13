import { describe, expect, it } from "vitest";
import { countryCodeToFlag } from "./country";

describe("countryCodeToFlag", () => {
  it.each([
    ["MX", "🇲🇽"],
    ["AR", "🇦🇷"],
    ["FR", "🇫🇷"],
    ["JP", "🇯🇵"],
    ["sa", "🇸🇦"], // lowercase tolerada
    [" gb ", "🇬🇧"], // padding tolerado
  ] as const)("converts %s → %s", (input, expected) => {
    expect(countryCodeToFlag(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "   ",
    "ARG", // FIFA 3-letter, no convertible
    "A",
    "1X",
    "X9",
  ] as const)("returns null for invalid input: %s", (input) => {
    expect(countryCodeToFlag(input)).toBeNull();
  });
});
