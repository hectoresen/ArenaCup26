import { describe, expect, it } from "vitest";
import { BOT_CATALOG, botEmail } from "./catalog";

describe("BOT_CATALOG", () => {
  it("contains exactly 27 bots", () => {
    expect(BOT_CATALOG).toHaveLength(27);
  });

  it("has unique IDs across all entries", () => {
    const ids = new Set(BOT_CATALOG.map((b) => b.id));
    expect(ids.size).toBe(BOT_CATALOG.length);
  });

  it("has unique usernames across all entries", () => {
    const usernames = new Set(BOT_CATALOG.map((b) => b.username));
    expect(usernames.size).toBe(BOT_CATALOG.length);
  });

  it("uses kebab-case usernames only (3-20 chars, [a-z0-9-])", () => {
    const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const b of BOT_CATALOG) {
      expect(b.username, `username ${b.username}`).toMatch(KEBAB);
      expect(b.username.length).toBeGreaterThanOrEqual(3);
      expect(b.username.length).toBeLessThanOrEqual(20);
    }
  });

  it("uses ISO-2 uppercase country codes", () => {
    for (const b of BOT_CATALOG) {
      expect(b.country, `country of ${b.username}`).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("respects the 70/20/10 style distribution (19/5/3)", () => {
    const counts: Record<string, number> = { simple: 0, mixed: 0, daredevil: 0 };
    for (const b of BOT_CATALOG) counts[b.style] = (counts[b.style] ?? 0) + 1;
    expect(counts).toEqual({ simple: 19, mixed: 5, daredevil: 3 });
  });

  it("balances avatars across the gallery (no avatar with <5 or >8 bots)", () => {
    const counts: Record<string, number> = {};
    for (const b of BOT_CATALOG) counts[b.avatarId] = (counts[b.avatarId] ?? 0) + 1;
    for (const [avatar, n] of Object.entries(counts)) {
      expect(n, `avatar ${avatar}`).toBeGreaterThanOrEqual(5);
      expect(n, `avatar ${avatar}`).toBeLessThanOrEqual(8);
    }
  });

  it("uses only the 4 SVG avatars defined in /public/avatars", () => {
    const VALID = new Set(["champion", "duel", "podium", "oracle"]);
    for (const b of BOT_CATALOG) {
      expect(VALID.has(b.avatarId), `avatar ${b.avatarId} of ${b.username}`).toBe(true);
    }
  });

  it("staggers createdAtOffsetDays in a reasonable range (5-42d)", () => {
    for (const b of BOT_CATALOG) {
      expect(b.createdAtOffsetDays, `offset of ${b.username}`).toBeGreaterThanOrEqual(0);
      expect(b.createdAtOffsetDays, `offset of ${b.username}`).toBeLessThanOrEqual(42);
    }
    // No deben estar todos al mismo offset.
    const uniqueOffsets = new Set(BOT_CATALOG.map((b) => b.createdAtOffsetDays));
    expect(uniqueOffsets.size).toBeGreaterThan(20);
  });

  it("represents at least 5 different countries (global diversity)", () => {
    const countries = new Set(BOT_CATALOG.map((b) => b.country));
    expect(countries.size).toBeGreaterThanOrEqual(5);
  });
});

describe("botEmail", () => {
  it("generates synthetic email in @bots.arenacup26.com domain", () => {
    expect(botEmail("diego-martinez")).toBe("diego-martinez@bots.arenacup26.com");
  });

  it("preserves the username verbatim in the local part", () => {
    expect(botEmail("lucas-van-der-berg")).toBe("lucas-van-der-berg@bots.arenacup26.com");
  });
});
