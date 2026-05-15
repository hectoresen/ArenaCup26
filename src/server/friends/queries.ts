import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/server/db/client";
import { friendships, userPoints, users } from "@/server/db/schema";
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
