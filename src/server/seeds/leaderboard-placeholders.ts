import { eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { userAchievements, userPoints, users } from "@/server/db/schema";

/**
 * 3 usuarios "placeholder" que decoran el leaderboard cuando todavía
 * no hay tráfico real. Antes vivían como datos hardcodeados en
 * `src/lib/leaderboard/real.ts`. Ahora son filas reales en BD: así,
 * un usuario que pulse sobre Carlos / Layla / Tomás desde el ranking
 * navega a `/u/<username>` y ve un perfil completo (stats + logros).
 *
 * Cuando suficientes usuarios reales superen sus puntos, los seeds
 * caen al fondo del ranking de forma natural. Una vez la app tenga
 * ~20 usuarios reales activos, se pueden retirar editando este array.
 *
 * IDs estables (`seed-*`) para que la función sea idempotente.
 */
const SEED_USERS = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    email: "seed-carlos@webmundial.local",
    username: "carlos-mendoza",
    name: "Carlos Mendoza",
    country: "MX",
    image: null as string | null,
    totalPoints: 4820,
    streak: 7,
    correctCount: 34,
    /** IDs de logros del catálogo a desbloquear (ver `achievements/catalog.ts`). */
    unlockedAchievements: ["first-hit", "good-eye", "first-hundred"],
  },
  {
    id: "00000000-0000-4000-a000-000000000002",
    email: "seed-layla@webmundial.local",
    username: "layla-hassan",
    name: "Layla Hassan",
    country: "SA",
    image: null as string | null,
    totalPoints: 4610,
    streak: 5,
    correctCount: 31,
    unlockedAchievements: ["first-hit", "first-hundred"],
  },
  {
    id: "00000000-0000-4000-a000-000000000003",
    email: "seed-tomas@webmundial.local",
    username: "tomas-reyes",
    name: "Tomás Reyes",
    country: "AR",
    image: null as string | null,
    totalPoints: 4390,
    streak: 4,
    correctCount: 29,
    unlockedAchievements: ["first-hit"],
  },
] as const;

/**
 * Inserta o actualiza los 3 usuarios placeholder + sus puntos +
 * algunos logros desbloqueados. Idempotente: re-ejecutar nunca
 * duplica filas, solo refresca puntos si se editan los seeds.
 *
 * Llamado desde `scripts/bootstrap.ts` en cada deploy.
 *
 * Solo intenta desbloquear logros cuyo id exista en
 * `achievement_definitions` (catálogo ya seedado por
 * `seedAchievements`); en otro caso ignora el id para no romper el
 * bootstrap si renombramos un achievement.
 */
export async function seedLeaderboardPlaceholders(db: Database): Promise<number> {
  let count = 0;
  for (const seed of SEED_USERS) {
    // 1) Upsert del user. `email` es NOT NULL en el schema (Auth.js
    //    DrizzleAdapter); usamos un dominio reservado para que no
    //    colisione con emails reales y se detecte como sintético.
    await db
      .insert(users)
      .values({
        id: seed.id,
        email: seed.email,
        name: seed.name,
        username: seed.username,
        country: seed.country,
        image: seed.image,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: seed.email,
          name: seed.name,
          username: seed.username,
          country: seed.country,
          image: seed.image,
        },
      });

    // 2) Upsert de sus puntos.
    await db
      .insert(userPoints)
      .values({
        userId: seed.id,
        totalPoints: seed.totalPoints,
        streak: seed.streak,
        correctCount: seed.correctCount,
      })
      .onConflictDoUpdate({
        target: userPoints.userId,
        set: {
          totalPoints: seed.totalPoints,
          streak: seed.streak,
          correctCount: seed.correctCount,
        },
      });

    // 3) Desbloquear logros (best-effort: si el id no existe en el
    //    catálogo, el FK falla y lo capturamos sin abortar).
    for (const achievementId of seed.unlockedAchievements) {
      try {
        await db
          .insert(userAchievements)
          .values({ userId: seed.id, achievementId })
          .onConflictDoNothing();
      } catch {
        // achievement id desconocido → ignorar.
      }
    }
    count++;
  }
  return count;
}

/**
 * Borra los 3 seed users + sus dependencias (cascade lo limpia).
 * Para retirar los placeholders cuando ya no aporten valor.
 */
export async function removeLeaderboardPlaceholders(db: Database): Promise<number> {
  let removed = 0;
  for (const seed of SEED_USERS) {
    const result = await db.delete(users).where(eq(users.id, seed.id));
    // drizzle no devuelve rowCount uniforme; contamos por entrada.
    if (result) removed++;
  }
  return removed;
}
