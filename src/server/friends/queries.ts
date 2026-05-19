import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/server/db/client";
import { friendships, predictions, userPoints, users } from "@/server/db/schema";
import type { GroupRankingEntry } from "@/server/groups/types";
import type { Friend, FriendRequest, ViewerRelation } from "./types";

/**
 * Variante de `getViewerRelation` que también devuelve el ID de la
 * fila en `friendships` cuando aplica (necesario para que el botón
 * "Aceptar solicitud" pueda llamar a `acceptFriendRequest(id)`).
 */
export async function getViewerRelationWithId(
  db: Database,
  viewerId: string | null,
  otherId: string,
): Promise<{ relation: ViewerRelation; friendshipId: string | null }> {
  if (!viewerId) return { relation: "none", friendshipId: null };
  if (viewerId === otherId) return { relation: "self", friendshipId: null };

  const rows = await db
    .select({
      id: friendships.id,
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      status: friendships.status,
    })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, viewerId), eq(friendships.addresseeId, otherId)),
        and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, viewerId)),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return { relation: "none", friendshipId: null };
  if (row.status === "accepted") return { relation: "accepted", friendshipId: row.id };
  if (row.status === "blocked") {
    return {
      relation: row.requesterId === viewerId ? "blocked-by-me" : "blocked-by-them",
      friendshipId: row.id,
    };
  }
  return {
    relation: row.requesterId === viewerId ? "pending-out" : "pending-in",
    friendshipId: row.id,
  };
}

/**
 * Devuelve la relación lógica entre `viewerId` y `otherId`. Hace una
 * sola query buscando filas en cualquiera de las dos direcciones.
 * Caso `viewerId === otherId` se resuelve sin tocar la BD.
 */
export async function getViewerRelation(
  db: Database,
  viewerId: string | null,
  otherId: string,
): Promise<ViewerRelation> {
  if (!viewerId) return "none";
  if (viewerId === otherId) return "self";

  const rows = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      status: friendships.status,
    })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, viewerId), eq(friendships.addresseeId, otherId)),
        and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, viewerId)),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return "none";
  if (row.status === "accepted") return "accepted";
  if (row.status === "blocked") {
    return row.requesterId === viewerId ? "blocked-by-me" : "blocked-by-them";
  }
  // pending
  return row.requesterId === viewerId ? "pending-out" : "pending-in";
}

/**
 * Devuelve la lista de amigos aceptados del user, con info pública
 * mínima para renderizar cards. Ordenados por `acceptedAt DESC` (más
 * recientes primero).
 */
export async function getFriends(db: Database, userId: string): Promise<Friend[]> {
  const otherUser = alias(users, "other_user");
  const rows = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      decidedAt: friendships.decidedAt,
      otherId: otherUser.id,
      otherName: otherUser.name,
      otherUsername: otherUser.username,
      otherCountry: otherUser.country,
      otherImage: otherUser.image,
      otherAvatarId: otherUser.avatarId,
      points: userPoints.totalPoints,
    })
    .from(friendships)
    .innerJoin(
      otherUser,
      or(
        and(eq(friendships.requesterId, userId), eq(otherUser.id, friendships.addresseeId)),
        and(eq(friendships.addresseeId, userId), eq(otherUser.id, friendships.requesterId)),
      ),
    )
    .leftJoin(userPoints, eq(userPoints.userId, otherUser.id))
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    )
    .orderBy(desc(friendships.decidedAt));

  return rows.map((row) => ({
    userId: row.otherId,
    name: row.otherName?.trim() || "Jugador",
    username: row.otherUsername,
    countryCode: row.otherCountry,
    image: row.otherImage,
    avatarId: row.otherAvatarId,
    points: row.points ?? 0,
    acceptedAt: row.decidedAt ?? new Date(0),
  }));
}

/**
 * Ranking "Amigos" para `/ranking?scope=amigos`. Conjunto: el propio
 * viewer + sus amigos aceptados. Mismo tie-break que el global:
 * points → streakMax → simpleHits → predictionsTotal → createdAt.
 *
 * Reutilizamos el tipo `GroupRankingEntry` para que `<GroupRankingList>`
 * lo renderice sin cambios. El flag `frozen` siempre es `false` aquí
 * (no aplica la lógica de ex-miembros).
 *
 * Si el user no tiene amigos, devuelve un array de 1 elemento (solo
 * el viewer). La UI decide qué copy mostrar.
 */
export async function getFriendsRanking(
  db: Database,
  viewerId: string,
): Promise<GroupRankingEntry[]> {
  // 1) IDs del subset: viewer + amigos.
  const friendRows = await db
    .select({
      requester: friendships.requesterId,
      addressee: friendships.addresseeId,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, viewerId), eq(friendships.addresseeId, viewerId)),
      ),
    );

  const friendIds = friendRows.map((r) =>
    r.requester === viewerId ? r.addressee : r.requester,
  );
  const subsetIds = [viewerId, ...friendIds];

  // 2) Datos de cada miembro + puntos.
  const userRows = await db
    .select({
      userId: users.id,
      username: users.username,
      name: users.name,
      country: users.country,
      avatarId: users.avatarId,
      image: users.image,
      createdAt: users.createdAt,
      points: userPoints.totalPoints,
      streak: userPoints.streak,
      streakMax: userPoints.streakMax,
      simpleHits: userPoints.simpleHits,
      correctCount: userPoints.correctCount,
    })
    .from(users)
    .leftJoin(userPoints, eq(userPoints.userId, users.id))
    .where(inArray(users.id, subsetIds));

  // 3) Conteo de predicciones (tie-break 4º).
  const predRows = await db
    .select({
      userId: predictions.userId,
      total: sql<number>`count(*)::int`,
    })
    .from(predictions)
    .where(inArray(predictions.userId, subsetIds))
    .groupBy(predictions.userId);
  const predMap = new Map(predRows.map((p) => [p.userId, p.total]));

  // 4) Sort con tie-break completo.
  const sorted = [...userRows].sort((a, b) => {
    const ap = a.points ?? 0;
    const bp = b.points ?? 0;
    if (ap !== bp) return bp - ap;
    const asm = a.streakMax ?? 0;
    const bsm = b.streakMax ?? 0;
    if (asm !== bsm) return bsm - asm;
    const ash = a.simpleHits ?? 0;
    const bsh = b.simpleHits ?? 0;
    if (ash !== bsh) return bsh - ash;
    const ap2 = predMap.get(a.userId) ?? 0;
    const bp2 = predMap.get(b.userId) ?? 0;
    if (ap2 !== bp2) return bp2 - ap2;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return sorted.map((r, i) => ({
    userId: r.userId,
    username: r.username,
    name: r.name?.trim() || "Jugador",
    countryCode: r.country,
    avatarId: r.avatarId,
    image: r.image,
    points: r.points ?? 0,
    streak: r.streak ?? 0,
    correctCount: r.correctCount ?? 0,
    frozen: false,
    rank: i + 1,
    rankDelta: null,
  }));
}

/**
 * Solicitudes de amistad recibidas por el user (las que él tiene que
 * aceptar/rechazar). Solo `status = 'pending'` donde el user es el
 * `addressee`. Útil para renderizar la bandeja de entrada y el badge
 * en el nav.
 */
export async function getPendingFriendRequests(
  db: Database,
  userId: string,
): Promise<FriendRequest[]> {
  const fromUser = alias(users, "from_user");
  const rows = await db
    .select({
      friendshipId: friendships.id,
      fromId: fromUser.id,
      fromName: fromUser.name,
      fromUsername: fromUser.username,
      fromCountry: fromUser.country,
      fromImage: fromUser.image,
      fromAvatarId: fromUser.avatarId,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(fromUser, eq(fromUser.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending")))
    .orderBy(desc(friendships.createdAt));

  return rows.map((row) => ({
    friendshipId: row.friendshipId,
    fromUserId: row.fromId,
    fromName: row.fromName?.trim() || "Jugador",
    fromUsername: row.fromUsername,
    fromCountryCode: row.fromCountry,
    fromImage: row.fromImage,
    fromAvatarId: row.fromAvatarId,
    createdAt: row.createdAt,
  }));
}

/**
 * Counter rápido de solicitudes pendientes para mostrar como badge en
 * el nav (e.g. "Amigos · 3"). Usa COUNT en BD, no carga las filas.
 */
export async function countPendingFriendRequests(
  db: Database,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(friendships)
    .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending")));
  return rows[0]?.total ?? 0;
}

/**
 * Verifica si dos users son amigos aceptados (en cualquier dirección
 * de la fila). Usado por `canViewProfile` para resolver el caso
 * `visibility = 'friends_only'`.
 */
export async function areFriends(
  db: Database,
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  if (userIdA === userIdB) return true;
  const rows = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, userIdA), eq(friendships.addresseeId, userIdB)),
          and(eq(friendships.requesterId, userIdB), eq(friendships.addresseeId, userIdA)),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
