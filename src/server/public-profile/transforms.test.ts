import { ACHIEVEMENT_CATALOG } from "@/server/achievements/catalog";
import { describe, expect, it } from "vitest";
import { TIER_ORDER, buildProfileAchievements, isShareable } from "./transforms";
import type { ProfileAchievement } from "./types";

describe("buildProfileAchievements", () => {
  it("includes all 24 achievements grouped by tier in canonical order", () => {
    const result = buildProfileAchievements(new Map());
    expect(result.totalCount).toBe(24);
    expect(result.unlockedCount).toBe(0);
    expect(result.groups.map((g) => g.tier)).toEqual([...TIER_ORDER]);
    const totalItems = result.groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(totalItems).toBe(24);
  });

  it("respects the 6/4/6/4/3/1 distribution of the catalog", () => {
    const result = buildProfileAchievements(new Map());
    const counts = Object.fromEntries(result.groups.map((g) => [g.tier, g.total]));
    expect(counts).toEqual({
      common: 6,
      rare: 4,
      epic: 6,
      legendary: 4,
      mythic: 3,
      goat: 1,
    });
  });

  it("marks an achievement as unlocked when its id is in the map", () => {
    const date = new Date("2026-06-12T10:00:00Z");
    const result = buildProfileAchievements(new Map([["first-hit", date]]));
    expect(result.unlockedCount).toBe(1);
    const firstHit = result.groups
      .flatMap((g) => g.items)
      .find((a) => a.definition.id === "first-hit");
    expect(firstHit?.unlocked).toBe(true);
    expect(firstHit?.unlockedAt).toEqual(date);
  });

  it("orders items inside a tier by sortOrder ASC", () => {
    const result = buildProfileAchievements(new Map());
    for (const group of result.groups) {
      const orders = group.items.map((a) => a.definition.sortOrder);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
    }
  });

  it("groups.unlocked counts only that tier's unlocked items", () => {
    // Desbloqueamos 2 common + 1 mythic
    const commons = ACHIEVEMENT_CATALOG.filter((d) => d.tier === "common").slice(0, 2);
    const mythics = ACHIEVEMENT_CATALOG.filter((d) => d.tier === "mythic").slice(0, 1);
    const unlocked = new Map(
      [...commons, ...mythics].map((d) => [d.id, new Date("2026-06-12T00:00:00Z")]),
    );
    const result = buildProfileAchievements(unlocked);
    expect(result.groups.find((g) => g.tier === "common")?.unlocked).toBe(2);
    expect(result.groups.find((g) => g.tier === "mythic")?.unlocked).toBe(1);
    expect(result.groups.find((g) => g.tier === "epic")?.unlocked).toBe(0);
  });
});

function entry(
  tier: "common" | "rare" | "epic" | "legendary" | "mythic" | "goat",
  unlocked: boolean,
): ProfileAchievement {
  const def = ACHIEVEMENT_CATALOG.find((d) => d.tier === tier);
  if (!def) throw new Error(`no def for tier ${tier}`);
  return {
    definition: def,
    unlocked,
    unlockedAt: unlocked ? new Date() : null,
  };
}

describe("isShareable", () => {
  it("returns true for legendary/mythic/goat when unlocked", () => {
    expect(isShareable(entry("legendary", true))).toBe(true);
    expect(isShareable(entry("mythic", true))).toBe(true);
    expect(isShareable(entry("goat", true))).toBe(true);
  });

  it("returns false for common/rare/epic regardless of unlock state", () => {
    expect(isShareable(entry("common", true))).toBe(false);
    expect(isShareable(entry("rare", true))).toBe(false);
    expect(isShareable(entry("epic", true))).toBe(false);
  });

  it("returns false when locked (even for high tiers)", () => {
    expect(isShareable(entry("legendary", false))).toBe(false);
    expect(isShareable(entry("goat", false))).toBe(false);
  });
});
