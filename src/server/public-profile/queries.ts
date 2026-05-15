import { countryCodeToFlag } from "@/lib/format/country";
import type { Database } from "@/server/db/client";
import { userAchievements, userPoints, users } from "@/server/db/schema";
import { canViewProfile, maskName, normalizePrivacy } from "@/server/privacy/apply";
import { eq, sql } from "drizzle-orm";
import { buildProfileAchievements } from "./transforms";
import type { PublicProfile } from "./types";

/**
 * Carga el perfil público de un usuario por su username. Devuelve
 * `null` si:
 *  - el username no existe, o
 *  - el owner ha puesto `privacy.visibility = 'private'` y el viewer
 *    no es él mismo (ni amigo, cuando aterrice `add-social-friends`).
 *
 * Los toggles individuales (`showName`, `showCountry`, etc.) NO
 * devuelven `null` — el perfil sigue accesible, pero los campos
 * sensibles se redactan/ocultan según preferencias.
 */
export async function getPublicProfile(
  db: Database,
  username: string,
  viewerId: string | null = null,
): Promise<PublicProfile | null> {
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      country: users.country,
      image: users.image,
      privacy: users.privacy,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const user = userRows[0];
  if (!user || !user.username) return null;

  const privacy = normalizePrivacy(user.privacy);
  if (!canViewProfile(privacy, user.id, viewerId)) return null;

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

  // Aplicamos los toggles individuales a la respuesta. El country/
  // image/points/achievements se "redactan" pero el perfil queda
  // visible. El username siempre se devuelve porque ya está en la
  // URL — esconderlo no aportaría nada.
  return {
    identity: {
      name: maskName(user.name, privacy),
      username: user.username,
      country: privacy.showCountry ? user.country : null,
      flag: privacy.showCountry ? countryCodeToFlag(user.country) : null,
      image: privacy.showImage ? user.image : null,
    },
    stats: {
      rank: privacy.showPoints ? rank : null,
      totalPlayers,
      points: privacy.showPoints ? points : 0,
      // pointsDelta queda null hasta `add-ranking-history`.
      pointsDelta: null,
    },
    achievements: privacy.showAchievements
      ? buildProfileAchievements(unlockedMap)
      : buildProfileAchievements(new Map()),
  };
}
