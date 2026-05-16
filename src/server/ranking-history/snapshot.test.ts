import { describe, expect, it } from "vitest";
import { summarizeRankHistory } from "./queries";
import { utcMidnight } from "./snapshot";

describe("summarizeRankHistory", () => {
  it("returns null/null when no snapshots exist (user nuevo o cron sin correr)", () => {
    expect(summarizeRankHistory([])).toEqual({ weekAgoRank: null, sparkline: null });
  });

  it("returns the same rank as weekAgo + sparkline of length 1 when there's a single snapshot", () => {
    // Delta = current - weekAgoRank = 0. La UI mostrará "Sin cambios".
    expect(summarizeRankHistory([{ rank: 42 }])).toEqual({
      weekAgoRank: 42,
      sparkline: [42],
    });
  });

  it("uses the OLDEST snapshot as weekAgoRank y preserva el orden ASC en la sparkline", () => {
    // Las filas llegan ordenadas por fecha ascendente desde la query
    // (ORDER BY snapshot_date ASC), así que el primer elemento es el
    // más antiguo y el último el más reciente.
    const result = summarizeRankHistory([
      { rank: 50 }, // hace 6 días
      { rank: 48 },
      { rank: 47 },
      { rank: 45 }, // hoy
    ]);
    expect(result.weekAgoRank).toBe(50);
    expect(result.sparkline).toEqual([50, 48, 47, 45]);
  });

  it("preserves any non-monotonic series (mejorar y empeorar es normal)", () => {
    const result = summarizeRankHistory([
      { rank: 30 },
      { rank: 25 }, // subió
      { rank: 28 }, // bajó
      { rank: 20 }, // volvió a subir
    ]);
    expect(result.weekAgoRank).toBe(30);
    expect(result.sparkline).toEqual([30, 25, 28, 20]);
  });
});

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
