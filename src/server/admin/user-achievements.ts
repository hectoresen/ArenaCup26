import { db } from "@/server/db/client";
import { achievementDefinitions, userAchievements } from "@/server/db/schema";
import { asc, eq } from "drizzle-orm";

export type AchievementRow = {
  id: string;
  title: string;
  description: string;
  tier: string;
  iconId: string | null;
  unlockedAt: Date | null;
};

/**
 * Devuelve TODOS los logros del catálogo con el estado "unlockedAt"
 * para el user dado (null si no lo tiene). Ordenado por sortOrder
 * y tier. Para que el admin pueda ver en una sola vista qué tiene
 * y qué le falta + pueda otorgar o retirar.
 */
export async function getUserAchievements(userId: string): Promise<AchievementRow[]> {
  const rows = await db
    .select({
      id: achievementDefinitions.id,
      title: achievementDefinitions.title,
      description: achievementDefinitions.description,
      tier: achievementDefinitions.tier,
      iconId: achievementDefinitions.iconId,
      unlockedAt: userAchievements.unlockedAt,
    })
    .from(achievementDefinitions)
    .leftJoin(userAchievements, eq(userAchievements.achievementId, achievementDefinitions.id))
    .where(
      // El JOIN puede dar dos rows si el user tiene varios — pero como
      // userAchievements es PK por (userId, achievementId), el LEFT JOIN
      // necesita el filtro por userId.
      eq(userAchievements.userId, userId),
    )
    .orderBy(asc(achievementDefinitions.sortOrder), asc(achievementDefinitions.id));

  // Esa query solo trae logros que el user TIENE. Para listar todos
  // incluyendo no desbloqueados, hacemos otra para los faltantes.
  const allDefs = await db
    .select({
      id: achievementDefinitions.id,
      title: achievementDefinitions.title,
      description: achievementDefinitions.description,
      tier: achievementDefinitions.tier,
      iconId: achievementDefinitions.iconId,
      sortOrder: achievementDefinitions.sortOrder,
    })
    .from(achievementDefinitions)
    .orderBy(asc(achievementDefinitions.sortOrder), asc(achievementDefinitions.id));

  const unlockedMap = new Map(rows.map((r) => [r.id, r.unlockedAt]));

  return allDefs.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    tier: d.tier,
    iconId: d.iconId,
    unlockedAt: unlockedMap.get(d.id) ?? null,
  }));
}
