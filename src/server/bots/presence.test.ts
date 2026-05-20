import { describe, expect, it } from "vitest";
import { BOT_CATALOG } from "./catalog";
import {
  LIVE_BOTS_END_DATE,
  LIVE_BOT_USERNAMES,
  getLiveBotIds,
} from "./presence";

/**
 * Tests puros del catálogo de bots "live". El path con BD
 * (`refreshLiveBotPresence`) se cubre indirectamente vía el cron
 * `auto-reject-bot-requests` en integration tests. Aquí solo validamos
 * que la lista esté bien tipada y que el cutoff sea sensato.
 */
describe("LIVE_BOT_USERNAMES", () => {
  it("contains exactly the 5 live bots", () => {
    expect(LIVE_BOT_USERNAMES).toHaveLength(5);
  });

  it("references usernames that exist in BOT_CATALOG", () => {
    const catalogUsernames = new Set(BOT_CATALOG.map((b) => b.username));
    for (const username of LIVE_BOT_USERNAMES) {
      expect(catalogUsernames.has(username), `${username} not in catalog`).toBe(true);
    }
  });

  it("has unique usernames", () => {
    const set = new Set(LIVE_BOT_USERNAMES);
    expect(set.size).toBe(LIVE_BOT_USERNAMES.length);
  });
});

describe("getLiveBotIds", () => {
  it("resolves usernames to IDs", () => {
    const ids = getLiveBotIds();
    expect(ids).toHaveLength(LIVE_BOT_USERNAMES.length);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f-]+$/);
    }
  });
});

describe("LIVE_BOTS_END_DATE", () => {
  it("falls after Mundial 2026 group stage end (≥ 2026-07-04)", () => {
    expect(LIVE_BOTS_END_DATE.getTime()).toBeGreaterThanOrEqual(
      new Date("2026-07-04T00:00:00Z").getTime(),
    );
  });
});
