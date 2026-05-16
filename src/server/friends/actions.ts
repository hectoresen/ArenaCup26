"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { dlog } from "@/lib/debug-log";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { friendships, users } from "@/server/db/schema";
import { notifyWithPush } from "@/server/notifications/notify-with-push";

export type FriendActionResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "user_not_found"
        | "self"
        | "already_pending"
        | "already_friends"
        | "blocked"
        | "not_pending";
    };

/**
 * Envía una solicitud de amistad al user identificado por `username`.
 * Defensas:
 *  - No puedes mandarte a ti mismo.
 *  - Si ya existe fila (en cualquier dirección) → devolvemos código
 *    específico para que la UI muestre el estado correcto sin error.
 *  - Si el otro user te ha bloqueado → comportamiento "silencioso":
 *    devolvemos `blocked` pero no exponemos qué dirección lo originó.
 *
 * Genera notificación `friend_request` para el destinatario.
 */
export async function sendFriendRequest(targetUsername: string): Promise<FriendActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const fromId = session.user.id;

  const targetRows = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(eq(users.username, targetUsername))
    .limit(1);
  const target = targetRows[0];
  if (!target) return { ok: false, code: "user_not_found" };
  if (target.id === fromId) return { ok: false, code: "self" };

  // ¿Existe ya relación en cualquier dirección?
  const existing = await db
    .select({
      id: friendships.id,
      requesterId: friendships.requesterId,
      status: friendships.status,
    })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, fromId), eq(friendships.addresseeId, target.id)),
        and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, fromId)),
      ),
    )
    .limit(1);

  const row = existing[0];
  if (row) {
    if (row.status === "blocked") return { ok: false, code: "blocked" };
    if (row.status === "accepted") return { ok: false, code: "already_friends" };
    return { ok: false, code: "already_pending" };
  }

  await db.insert(friendships).values({
    requesterId: fromId,
    addresseeId: target.id,
    status: "pending",
  });

  await notifyWithPush({
    db,
    userId: target.id,
    kind: "friend_request",
    title: `${session.user.name ?? "Alguien"} te ha enviado una solicitud de amistad`,
    body: null,
    pushable: true,
  });

  dlog("ranking", "friend_request_sent", { fromId, toId: target.id });

  revalidatePath("/amigos");
  if (target.username) revalidatePath(`/u/${target.username}`);
  return { ok: true };
}

/**
 * Acepta una solicitud pendiente. Solo el `addressee` original puede
 * aceptar — verificación de ownership defensa en BD via WHERE.
 */
export async function acceptFriendRequest(friendshipId: string): Promise<FriendActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  const rows = await db
    .update(friendships)
    .set({ status: "accepted", decidedAt: new Date() })
    .where(
      and(
        eq(friendships.id, friendshipId),
        eq(friendships.addresseeId, userId),
        eq(friendships.status, "pending"),
      ),
    )
    .returning({ requesterId: friendships.requesterId });

  const row = rows[0];
  if (!row) return { ok: false, code: "not_pending" };

  await notifyWithPush({
    db,
    userId: row.requesterId,
    kind: "friend_accepted",
    title: `${session.user.name ?? "Tu amigo"} ha aceptado tu solicitud`,
    body: null,
    pushable: true,
  });

  dlog("ranking", "friend_request_accepted", { friendshipId, by: userId });

  revalidatePath("/amigos");
  return { ok: true };
}

/**
 * Rechaza una solicitud pendiente: borra la fila para que el
 * remitente pueda mandar otra solicitud en el futuro si quiere
 * (semántica más amable que dejar el rechazo "marcado").
 */
export async function rejectFriendRequest(friendshipId: string): Promise<FriendActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  const rows = await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, friendshipId),
        eq(friendships.addresseeId, userId),
        eq(friendships.status, "pending"),
      ),
    )
    .returning({ id: friendships.id });

  if (rows.length === 0) return { ok: false, code: "not_pending" };
  dlog("ranking", "friend_request_rejected", { friendshipId, by: userId });
  revalidatePath("/amigos");
  return { ok: true };
}

/**
 * Elimina una amistad aceptada (en cualquier dirección). Devuelve
 * `ok` también si no había fila — idempotente para que dos clicks
 * seguidos no fallen.
 */
export async function removeFriend(otherUserId: string): Promise<FriendActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, otherUserId)),
          and(eq(friendships.requesterId, otherUserId), eq(friendships.addresseeId, userId)),
        ),
      ),
    );

  dlog("ranking", "friend_removed", { userId, otherUserId });
  revalidatePath("/amigos");
  return { ok: true };
}
