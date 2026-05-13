import type { AchievementDefinition, AchievementTier } from "@/server/achievements/catalog";

export type ProfileIdentity = {
  name: string;
  username: string;
  /** ISO 3166-1 alpha-2 si se guardó en onboarding; null si no. */
  country: string | null;
  /** Emoji bandera derivado del country (lo calcula la capa de query). */
  flag: string | null;
  image: string | null;
};

export type ProfileStats = {
  /** Posición en el ranking global. `null` si el user no tiene puntos. */
  rank: number | null;
  totalPlayers: number;
  points: number;
  /** Variación semanal. `null` hasta que aterrice `add-ranking-history`. */
  pointsDelta: number | null;
};

export type ProfileAchievement = {
  definition: AchievementDefinition;
  unlocked: boolean;
  unlockedAt: Date | null;
};

export type ProfileAchievementTierGroup = {
  tier: AchievementTier;
  unlocked: number;
  total: number;
  items: ProfileAchievement[];
};

export type ProfileAchievements = {
  unlockedCount: number;
  totalCount: number;
  groups: ProfileAchievementTierGroup[];
};

export type PublicProfile = {
  identity: ProfileIdentity;
  stats: ProfileStats;
  achievements: ProfileAchievements;
};
