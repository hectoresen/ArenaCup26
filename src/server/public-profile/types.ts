import type { AchievementDefinition, AchievementTier } from "@/server/achievements/catalog";
import type { HistoryEntry } from "@/server/history/types";

export type ProfileIdentity = {
  /** UUID interno del owner. Necesario para acciones tipo `removeFriend`. */
  userId: string;
  name: string;
  username: string;
  /** ISO 3166-1 alpha-2 si se guardó en onboarding; null si no. */
  country: string | null;
  /** Emoji bandera derivado del country (lo calcula la capa de query). */
  flag: string | null;
  /** Foto del provider (Google) si está y el user no la ha ocultado. */
  image: string | null;
  /**
   * ID del avatar elegido en la galería (`src/server/profile/avatars.ts`).
   * Si está set, prevalece sobre `image` en el render del avatar.
   */
  avatarId: string | null;
  /**
   * `true` si el `lastActiveAt` está dentro de la ventana de 24h
   * (mismo umbral que el ranking, ver `src/lib/leaderboard/real.ts`).
   * Renderiza el puntito verde sobre el avatar en el hero.
   */
  isOnline: boolean;
};

export type ProfileStats = {
  /**
   * Posición en el ranking global. **Siempre** un número — el ranking
   * es inamovible y todos los users registrados aparecen, incluso los
   * que aún no tienen puntos.
   */
  rank: number;
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
  /**
   * Últimas N predicciones del owner. Vacío si:
   *  - El owner desactivó `privacy.showHistory`, o
   *  - El owner no tiene predicciones todavía.
   * El owner SIEMPRE recibe su histórico aquí (independiente del
   * toggle); para visitantes, depende del toggle.
   */
  publicHistory: HistoryEntry[];
};
