import { describe, expect, it } from "vitest";
import { formatMatchDate, formatMatchTime, isSameUtcDay } from "./date";

const NOW = new Date("2026-06-12T10:00:00Z");

describe("isSameUtcDay", () => {
  it.each([
    ["2026-06-12T00:00:00Z", "2026-06-12T23:59:59Z", true],
    ["2026-06-12T10:00:00Z", "2026-06-13T01:00:00Z", false],
    ["2026-06-12T10:00:00Z", "2026-06-12T10:00:00Z", true],
  ] as const)("isSameUtcDay(%s, %s) → %s", (a, b, expected) => {
    expect(isSameUtcDay(new Date(a), new Date(b))).toBe(expected);
  });
});

describe("formatMatchDate (es)", () => {
  it("returns 'Hoy' when the date is the same UTC day as now", () => {
    expect(formatMatchDate(new Date("2026-06-12T21:00:00Z"), "es", NOW)).toBe("Hoy");
  });

  it("returns 'Mañana' for the next UTC day", () => {
    expect(formatMatchDate(new Date("2026-06-13T18:00:00Z"), "es", NOW)).toBe("Mañana");
  });

  it("returns 'DD mmm' for dates beyond tomorrow", () => {
    expect(formatMatchDate(new Date("2026-07-09T15:00:00Z"), "es", NOW)).toBe("09 jul");
  });

  it("pads single-digit days with a leading zero", () => {
    expect(formatMatchDate(new Date("2026-06-30T18:00:00Z"), "es", NOW)).toBe("30 jun");
    expect(formatMatchDate(new Date("2026-07-03T18:00:00Z"), "es", NOW)).toBe("03 jul");
  });

  it("does NOT roll over to 'Hoy' on a same-day timestamp in a different timezone (UTC compared)", () => {
    // 2026-06-13 23:30 UTC vs now=2026-06-12T10:00Z. NO es el mismo día UTC.
    expect(formatMatchDate(new Date("2026-06-13T23:30:00Z"), "es", NOW)).toBe("Mañana");
  });
});

describe("formatMatchDate (en)", () => {
  it("translates today / tomorrow", () => {
    expect(formatMatchDate(new Date("2026-06-12T21:00:00Z"), "en", NOW)).toBe("Today");
    expect(formatMatchDate(new Date("2026-06-13T18:00:00Z"), "en", NOW)).toBe("Tomorrow");
  });

  it("uses English month abbreviation", () => {
    expect(formatMatchDate(new Date("2026-07-09T15:00:00Z"), "en", NOW)).toBe("09 Jul");
  });
});

describe("formatMatchDate (fr)", () => {
  it("translates today / tomorrow", () => {
    expect(formatMatchDate(new Date("2026-06-12T21:00:00Z"), "fr", NOW)).toBe("Aujourd'hui");
    expect(formatMatchDate(new Date("2026-06-13T18:00:00Z"), "fr", NOW)).toBe("Demain");
  });

  it("uses French month abbreviation", () => {
    expect(formatMatchDate(new Date("2026-07-09T15:00:00Z"), "fr", NOW)).toBe("09 juil");
  });
});

describe("formatMatchDate (ar)", () => {
  it("translates today / tomorrow in Arabic", () => {
    expect(formatMatchDate(new Date("2026-06-12T21:00:00Z"), "ar", NOW)).toBe("اليوم");
    expect(formatMatchDate(new Date("2026-06-13T18:00:00Z"), "ar", NOW)).toBe("غدًا");
  });

  it("uses Arabic month names", () => {
    expect(formatMatchDate(new Date("2026-07-09T15:00:00Z"), "ar", NOW)).toBe("09 يوليو");
  });
});

describe("formatMatchTime", () => {
  it.each([
    ["2026-06-12T15:00:00Z", "15:00"],
    ["2026-06-12T21:00:00Z", "21:00"],
    ["2026-06-12T09:05:00Z", "09:05"],
    ["2026-06-12T00:00:00Z", "00:00"],
  ] as const)("formats %s as %s", (input, expected) => {
    expect(formatMatchTime(new Date(input))).toBe(expected);
  });
});
