import { ACHIEVEMENT_CATALOG, type AchievementTier } from "@/server/achievements/catalog";
import type { ProfileAchievement, ProfileAchievementTierGroup, ProfileAchievements } from "./types";

/**
 * Orden canónico de tiers en el acordeón. Coincide con `docs/achievements.md`.
 */
export const TIER_ORDER: readonly AchievementTier[] = [
  "common",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "goat",
] as const;

/**
 * `true` si el logro debe mostrar el botón "Compartir" al hover.
 * Cualquier logro desbloqueado lo lleva (decisión 2026-06-17:
 * desbloquear es ya el hito; el user debería poder presumir de
 * cualquiera, no solo de los de élite).
 */
export function isShareable(achievement: ProfileAchievement): boolean {
  return achievement.unlocked;
}

/**
 * Construye los `ProfileAchievements` agrupando el catálogo completo
 * por tier y marcando cada uno como unlocked/locked según el `Map`
 * provisto.
 *
 * El catálogo se ordena por `sortOrder` dentro de cada tier para que el
 * grid sea estable entre cargas.
 */
export function buildProfileAchievements(
  unlockedAtById: ReadonlyMap<string, Date>,
): ProfileAchievements {
  const groupsMap = new Map<AchievementTier, ProfileAchievement[]>();
  for (const tier of TIER_ORDER) groupsMap.set(tier, []);

  const sorted = [...ACHIEVEMENT_CATALOG].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const definition of sorted) {
    const unlockedAt = unlockedAtById.get(definition.id) ?? null;
    const bucket = groupsMap.get(definition.tier);
    if (!bucket) continue;
    bucket.push({
      definition,
      unlocked: unlockedAt !== null,
      unlockedAt,
    });
  }

  const groups: ProfileAchievementTierGroup[] = TIER_ORDER.map((tier) => {
    const items = groupsMap.get(tier) ?? [];
    return {
      tier,
      total: items.length,
      unlocked: items.filter((it) => it.unlocked).length,
      items,
    };
  });

  return {
    unlockedCount: groups.reduce((sum, g) => sum + g.unlocked, 0),
    totalCount: ACHIEVEMENT_CATALOG.length,
    groups,
  };
}
