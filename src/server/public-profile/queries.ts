import { countryCodeToFlag } from "@/lib/format/country";
import type { Database } from "@/server/db/client";
import { userAchievements, userPoints, users } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { buildProfileAchievements } from "./transforms";
import type { PublicProfile } from "./types";

/**
 * Carga el perfil público de un usuario por su username. Devuelve
 * `null` si el username no existe; el caller (route handler) decide
 * llamar `notFound()`.
 *
 * Hace 4 queries en paralelo:
 *  1. `users` por username (necesario para validar existencia y para
 *     hidratar el resto con su userId).
 *  2. `userPoints` del user.
 *  3. `count(*)` de `userPoints` para totalPlayers.
 *  4. `userAchievements` del user.
 *
 * El "rank" se calcula con `count(... where totalPoints > X)`.
 */
export async function getPublicProfile(
  db: Database,
  username: string,
): Promise<PublicProfile | null> {
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      country: users.country,
      image: users.image,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const user = userRows[0];
  if (!user || !user.username) return null;

  const [pointsRows, totalRows, achievementRows] = await Promise.all([
    db
      .select({
        totalPoints: userPoints.totalPoints,
      })
      .from(userPoints)
      .where(eq(userPoints.userId, user.id))
      .limit(1),
    db.select({ total: sql<number>`count(*)::int` }).from(userPoints),
    db
      .select({
        achievementId: userAchievements.achievementId,
        unlockedAt: userAchievements.unlockedAt,
      })
      .from(userAchievements)
      .where(eq(userAchievements.userId, user.id)),
  ]);

  const points = pointsRows[0]?.totalPoints ?? 0;
  const totalPlayers = totalRows[0]?.total ?? 0;

  let rank: number | null = null;
  if (pointsRows[0]) {
    const aheadRows = await db
      .select({ ahead: sql<number>`count(*)::int` })
      .from(userPoints)
      .where(sql`${userPoints.totalPoints} > ${points}`);
    rank = (aheadRows[0]?.ahead ?? 0) + 1;
  }

  const unlockedMap = new Map(achievementRows.map((r) => [r.achievementId, r.unlockedAt]));

  return {
    identity: {
      name: user.name ?? user.username,
      username: user.username,
      country: user.country,
      flag: countryCodeToFlag(user.country),
      image: user.image,
    },
    stats: {
      rank,
      totalPlayers,
      points,
      // pointsDelta queda null hasta `add-ranking-history`.
      pointsDelta: null,
    },
    achievements: buildProfileAchievements(unlockedMap),
  };
}
