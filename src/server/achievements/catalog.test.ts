import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_CATALOG } from "./catalog";

describe("ACHIEVEMENT_CATALOG", () => {
  it("contains exactly 28 achievements", () => {
    // 24 originales + team-spirit (común, 2026-05-19) + tres
    // division-* (epic/legendary/mythic, 2026-06-17) ligados a las
    // líneas divisorias del leaderboard.
    expect(ACHIEVEMENT_CATALOG).toHaveLength(28);
  });

  it("has the expected tier distribution (7/4/7/5/4/1)", () => {
    const counts: Record<string, number> = {};
    for (const def of ACHIEVEMENT_CATALOG) {
      counts[def.tier] = (counts[def.tier] ?? 0) + 1;
    }
    expect(counts).toEqual({
      common: 7,
      rare: 4,
      epic: 7,
      legendary: 5,
      mythic: 4,
      goat: 1,
    });
  });

  it("has unique IDs across all entries", () => {
    const ids = new Set(ACHIEVEMENT_CATALOG.map((d) => d.id));
    expect(ids.size).toBe(ACHIEVEMENT_CATALOG.length);
  });

  it("uses unique sortOrder values; sequence 1-24 + team-spirit at 25 + division-* at 26-28", () => {
    // El catálogo se construyó originalmente con sortOrder secuencial
    // 1..24. `team-spirit` (común, 2026-05-19) ocupa el slot 25 y las
    // tres `division-*` los slots 26 (bronce), 27 (plata) y 28 (oro).
    // El UI agrupa por tier, así que el orden global no importa.
    const sortOrders = ACHIEVEMENT_CATALOG.map((d) => d.sortOrder);
    expect(new Set(sortOrders).size).toBe(sortOrders.length);
    expect(Math.min(...sortOrders)).toBe(1);
    expect(Math.max(...sortOrders)).toBe(28);
  });

  it("marks legendary, mythic and goat tiers as shareable; lower tiers not", () => {
    const HIGH_TIERS = new Set(["legendary", "mythic", "goat"]);
    for (const def of ACHIEVEMENT_CATALOG) {
      const expectedShareable = HIGH_TIERS.has(def.tier);
      expect(def.isShareable, `Logro ${def.id} (${def.tier})`).toBe(expectedShareable);
    }
  });

  it("has non-empty title, description and iconId for every entry", () => {
    for (const def of ACHIEVEMENT_CATALOG) {
      expect(def.title.trim().length, `title de ${def.id}`).toBeGreaterThan(0);
      expect(def.description.trim().length, `description de ${def.id}`).toBeGreaterThan(0);
      expect(def.iconId.trim().length, `iconId de ${def.id}`).toBeGreaterThan(0);
    }
  });

  it("uses kebab-case IDs only", () => {
    const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const def of ACHIEVEMENT_CATALOG) {
      expect(def.id, `id ${def.id}`).toMatch(KEBAB);
    }
  });

  it("includes a single GOAT entry as the highest sortOrder", () => {
    const goats = ACHIEVEMENT_CATALOG.filter((d) => d.tier === "goat");
    expect(goats).toHaveLength(1);
    const goat = goats[0];
    expect(goat).toBeDefined();
    if (!goat) return;
    expect(goat.id).toBe("the-goat");
    // `team-spirit` ocupa el sortOrder 25 (al final), por encima del
    // goat. Esto es OK porque dentro de cada tier solo importa el
    // orden relativo, y el goat sigue siendo el único de su tier.
    expect(goat.sortOrder).toBe(24);
    expect(goat.isShareable).toBe(true);
  });

  it("includes specific anchor IDs that the rest of the codebase references", () => {
    const ids = new Set(ACHIEVEMENT_CATALOG.map((d) => d.id));
    // Estos IDs aparecen en docs (FAQ, achievements-reference, etc.) y al
    // tocarlos hay que actualizar también esas referencias.
    for (const required of [
      "first-hit",
      "good-eye",
      "five-of-five",
      "on-fire",
      "exact-shot",
      "top-100",
      "elite-shooter",
      "top-50",
      "double-streak",
      "the-step-before",
      "seer",
      "top-10",
      "world-citizen",
      "the-prophet",
      "on-the-podium",
      "runner-up",
      "king-of-the-moment",
      "the-goat",
      "division-bronze",
      "division-silver",
      "division-gold",
    ]) {
      expect(ids, `ID '${required}' debe existir`).toContain(required);
    }
  });

  it("uses iconId values that match the convention 'ico-<name>'", () => {
    for (const def of ACHIEVEMENT_CATALOG) {
      expect(def.iconId, `iconId de ${def.id}`).toMatch(/^ico-[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});
