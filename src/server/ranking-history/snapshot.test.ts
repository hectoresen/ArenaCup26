import { describe, expect, it } from "vitest";
import { utcMidnight } from "./snapshot";

describe("utcMidnight", () => {
  it("zeros out hours/minutes/seconds/ms in UTC", () => {
    const d = utcMidnight(new Date("2026-05-15T18:42:13.456Z"));
    expect(d.toISOString()).toBe("2026-05-15T00:00:00.000Z");
  });

  it("is idempotent (calling twice gives the same date)", () => {
    const once = utcMidnight(new Date("2026-05-15T23:59:59.999Z"));
    const twice = utcMidnight(once);
    expect(twice.toISOString()).toBe(once.toISOString());
  });

  it("uses UTC, not local TZ — input -04:00 on the next day boundary", () => {
    // 22:30 -04:00 = 02:30 UTC del día siguiente.
    const d = utcMidnight(new Date("2026-05-15T22:30:00-04:00"));
    expect(d.toISOString()).toBe("2026-05-16T00:00:00.000Z");
  });
});
