import { countryCodeToFlag } from "@/lib/format/country";
import type { Database } from "@/server/db/client";
import { userAchievements, userPoints, users } from "@/server/db/schema";
import { areFriends } from "@/server/friends/queries";
import { canViewProfile, normalizePrivacy } from "@/server/privacy/apply";
import { eq, sql } from "drizzle-orm";
import { buildProfileAchievements } from "./transforms";
import type { PublicProfile } from "./types";

export type PublicProfileResult =
  | { kind: "found"; profile: PublicProfile }
  | { kind: "private"; identity: { name: string; flag: string | null; avatarId: string | null; image: string | null } }
  | { kind: "not_found" };

/**
 * Carga el perfil público de un usuario por su username.
 *
 * - `kind: "not_found"` cuando el username no existe (404).
 * - `kind: "private"` cuando el owner ha cerrado el perfil
 *   (`visibility` ≠ `'public'`) y el viewer no es él mismo. La página
 *   muestra el cartel "Perfil privado" con identidad mínima.
 * - `kind: "found"` para todos los demás: perfil completo. El ranking
 *   global siempre lleva aquí — la privacidad solo decide qué
 *   componente renderiza la página, no si la página existe.
 *
 * Cuando aterrice `add-social-friends`, la rama `friends_only` se
 * resolverá contra la tabla `friendships`.
 */
export async function getPublicProfile(
  db: Database,
  username: string,
  viewerId: string | null = null,
): Promise<PublicProfileResult> {
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      country: users.country,
      image: users.image,
      avatarId: users.avatarId,
      privacy: users.privacy,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const user = userRows[0];
  if (!user || !user.username) return { kind: "not_found" };

  const privacy = normalizePrivacy(user.privacy);
  const visibleName = user.name?.trim() || "Jugador";
  const flag = countryCodeToFlag(user.country);

  // Solo necesitamos resolver amistad si el visibility es
  // `friends_only` Y hay viewer Y no es el dueño. En cualquier otro
  // caso `canViewProfile` decide sin tocar la BD.
  const needsFriendCheck =
    privacy.visibility === "friends_only" && viewerId !== null && viewerId !== user.id;
  const isFriend = needsFriendCheck ? await areFriends(db, viewerId, user.id) : false;

  if (!canViewProfile(privacy, user.id, viewerId, isFriend)) {
    return {
      kind: "private",
      identity: {
        name: visibleName,
        flag,
        avatarId: user.avatarId,
        image: user.image,
      },
    };
  }

  const [pointsRows, totalRows, achievementRows] = await Promise.all([
    db
      .select({
        totalPoints: userPoints.totalPoints,
      })
      .from(userPoints)
      .where(eq(userPoints.userId, user.id))
      .limit(1),
    db.select({ total: sql<number>`count(*)::int` }).from(users),
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

  // Ranking inamovible: todos los users tienen rank. Si el user aún
  // no tiene fila en `user_points`, lo tratamos como 0 puntos y
  // recibe el rank de la cola.
  const aheadRows = await db
    .select({ ahead: sql<number>`count(*)::int` })
    .from(userPoints)
    .where(sql`${userPoints.totalPoints} > ${points}`);
  const rank: number = (aheadRows[0]?.ahead ?? 0) + 1;

  const unlockedMap = new Map(achievementRows.map((r) => [r.achievementId, r.unlockedAt]));

  return {
    kind: "found",
    profile: {
      identity: {
        userId: user.id,
        name: visibleName,
        username: user.username,
        country: user.country,
        flag,
        image: user.image,
        avatarId: user.avatarId,
      },
      stats: {
        rank,
        totalPlayers,
        points,
        // pointsDelta queda null hasta `add-ranking-history`.
        pointsDelta: null,
      },
      achievements: buildProfileAchievements(unlockedMap),
    },
  };
}
