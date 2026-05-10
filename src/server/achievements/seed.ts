import type { Database } from "@/server/db/client";
import { achievementDefinitions } from "@/server/db/schema";
import { ACHIEVEMENT_CATALOG } from "./catalog";

/**
 * Inserta o actualiza el catálogo de logros en la BD.
 *
 * Idempotente: usa `ON CONFLICT (id) DO UPDATE` para que volver a correr
 * el seed tras un cambio en `catalog.ts` simplemente actualice las filas.
 *
 * Devuelve el número de filas afectadas (insertadas o actualizadas).
 */
export async function seedAchievements(db: Database): Promise<number> {
  let count = 0;
  for (const def of ACHIEVEMENT_CATALOG) {
    await db
      .insert(achievementDefinitions)
      .values({
        id: def.id,
        title: def.title,
        description: def.description,
        tier: def.tier,
        isShareable: def.isShareable,
        iconId: def.iconId,
        sortOrder: def.sortOrder,
      })
      .onConflictDoUpdate({
        target: achievementDefinitions.id,
        set: {
          title: def.title,
          description: def.description,
          tier: def.tier,
          isShareable: def.isShareable,
          iconId: def.iconId,
          sortOrder: def.sortOrder,
        },
      });
    count++;
  }
  return count;
}
