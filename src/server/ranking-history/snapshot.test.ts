import { describe, expect, it } from "vitest";
import { summarizeRankHistory } from "./queries";
import { utcMidnight } from "./snapshot";

// Helper para construir un cutoff `dayAgo` consistente. La transform
// solo necesita comparar fechas, así que un fixed reference basta.
const TODAY = utcMidnight(new Date("2026-05-20T12:00:00Z"));
const DAY_AGO = new Date(TODAY.getTime() - 24 * 60 * 60 * 1000);
const TWO_DAYS_AGO = new Date(TODAY.getTime() - 2 * 24 * 60 * 60 * 1000);
const SIX_DAYS_AGO = new Date(TODAY.getTime() - 6 * 24 * 60 * 60 * 1000);
const FIVE_DAYS_AGO = new Date(TODAY.getTime() - 5 * 24 * 60 * 60 * 1000);
const FOUR_DAYS_AGO = new Date(TODAY.getTime() - 4 * 24 * 60 * 60 * 1000);
const THREE_DAYS_AGO = new Date(TODAY.getTime() - 3 * 24 * 60 * 60 * 1000);

describe("summarizeRankHistory", () => {
  it("returns null/null when no snapshots exist (user nuevo o cron sin correr)", () => {
    expect(summarizeRankHistory([], DAY_AGO)).toEqual({
      dayAgoRank: null,
      sparkline: null,
    });
  });

  it("dayAgoRank=null si solo hay snapshot de HOY (cron de ayer sin correr)", () => {
    // Sparkline tiene 1 punto pero ese punto es hoy → no hay baseline
    // para el delta 24h.
    expect(
      summarizeRankHistory([{ rank: 42, snapshotDate: TODAY }], DAY_AGO),
    ).toEqual({
      dayAgoRank: null,
      sparkline: [42],
    });
  });

  it("dayAgoRank = snapshot de ayer cuando ese existe", () => {
    const result = summarizeRankHistory(
      [
        { rank: 50, snapshotDate: SIX_DAYS_AGO },
        { rank: 48, snapshotDate: THREE_DAYS_AGO },
        { rank: 47, snapshotDate: DAY_AGO }, // baseline para delta 24h
        { rank: 45, snapshotDate: TODAY },
      ],
      DAY_AGO,
    );
    expect(result.dayAgoRank).toBe(47);
    expect(result.sparkline).toEqual([50, 48, 47, 45]);
  });

  it("si no hay snapshot exactamente de ayer, cae al más reciente anterior", () => {
    // Cron ha estado caído el día de ayer; el más reciente que cumple
    // <= dayAgo es el de hace 3 días. Mantiene la señal aunque
    // imperfecta.
    const result = summarizeRankHistory(
      [
        { rank: 30, snapshotDate: SIX_DAYS_AGO },
        { rank: 25, snapshotDate: THREE_DAYS_AGO },
        { rank: 20, snapshotDate: TODAY },
      ],
      DAY_AGO,
    );
    expect(result.dayAgoRank).toBe(25);
    expect(result.sparkline).toEqual([30, 25, 20]);
  });

  it("preserves any non-monotonic series (mejorar y empeorar es normal)", () => {
    const result = summarizeRankHistory(
      [
        { rank: 30, snapshotDate: FIVE_DAYS_AGO },
        { rank: 25, snapshotDate: FOUR_DAYS_AGO },
        { rank: 28, snapshotDate: TWO_DAYS_AGO },
        { rank: 20, snapshotDate: DAY_AGO },
      ],
      DAY_AGO,
    );
    expect(result.dayAgoRank).toBe(20);
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
