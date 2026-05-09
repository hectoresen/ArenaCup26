import { describe, expect, it } from "vitest";
import { getInitialSnapshot } from "./mock";

describe("getInitialSnapshot", () => {
  it("returns 10 players", async () => {
    const snapshot = await getInitialSnapshot();
    expect(snapshot.players).toHaveLength(10);
  });

  it("orders players by points descending", async () => {
    const snapshot = await getInitialSnapshot();
    for (let i = 0; i < snapshot.players.length - 1; i++) {
      const current = snapshot.players[i];
      const next = snapshot.players[i + 1];
      if (!current || !next) throw new Error("missing player");
      expect(current.points).toBeGreaterThanOrEqual(next.points);
    }
  });

  it("assigns sequential ranks starting at 1", async () => {
    const snapshot = await getInitialSnapshot();
    snapshot.players.forEach((p, i) => {
      expect(p.rank).toBe(i + 1);
    });
  });

  it("initializes previousRank equal to rank for the snapshot baseline", async () => {
    const snapshot = await getInitialSnapshot();
    for (const p of snapshot.players) {
      expect(p.previousRank).toBe(p.rank);
    }
  });

  it("provides a parseable ISO generatedAt timestamp", async () => {
    const snapshot = await getInitialSnapshot();
    expect(() => new Date(snapshot.generatedAt).toISOString()).not.toThrow();
  });
});
