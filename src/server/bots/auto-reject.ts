import { and, eq, inArray, lt } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { friendships, groupInvitations, users } from "@/server/db/schema";

/**
 * Limpia los friend requests y group invitations dirigidos a BOTS
 * con > 48h en `pending`:
 *
 *  - **Friendships**: el enum solo tiene `pending|accepted|blocked`
 *    (no `rejected`). La convención del producto es BORRAR la fila
 *    al rechazar (ver `rejectFriendRequest` en
 *    `src/server/friends/actions.ts`). Hacemos lo mismo.
 *  - **Group invitations**: el enum tiene `rejected`. Marcamos sin
 *    borrar para preservar histórico.
 *
 * Idempotente: corre cada día. La primera vez puede tocar muchas
 * filas; los siguientes runs son baratos.
 *
 * **No afecta** a requests entre humanos: filtra explicitamente
 * por `users.isBot = true` del destinatario.
 *
 * Devuelve un report con conteos por tabla afectada.
 */
export type AutoRejectReport = {
  friendshipsRejected: number;
  groupInvitationsRejected: number;
};

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

export async function autoRejectStaleBotRequests(
  db: Database,
  now: Date = new Date(),
): Promise<AutoRejectReport> {
  const threshold = new Date(now.getTime() - TWO_DAYS_MS);

  // 1) Friendships pending dirigidas a bots, > 48h. La tabla usa
  //    `requester_id → addressee_id` direccional. Solo el bot como
  //    addressee. Se BORRAN (no hay `rejected` en el enum;
  //    convención del producto: rechazar = delete).
  const friendIds = await db
    .select({ id: friendships.id })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.addresseeId))
    .where(
      and(
        eq(friendships.status, "pending"),
        eq(users.isBot, true),
        lt(friendships.createdAt, threshold),
      ),
    );

  let friendshipsRejected = 0;
  if (friendIds.length > 0) {
    const deleted = await db
      .delete(friendships)
      .where(inArray(friendships.id, friendIds.map((r) => r.id)))
      .returning({ id: friendships.id });
    friendshipsRejected = deleted.length;
  }

  // 2) Group invitations pending a bots, > 48h. Estas SÍ se marcan
  //    como `rejected` (el enum lo soporta y preservamos histórico).
  const groupInvIds = await db
    .select({ id: groupInvitations.id })
    .from(groupInvitations)
    .innerJoin(users, eq(users.id, groupInvitations.inviteeId))
    .where(
      and(
        eq(groupInvitations.status, "pending"),
        eq(users.isBot, true),
        lt(groupInvitations.createdAt, threshold),
      ),
    );

  let groupInvitationsRejected = 0;
  if (groupInvIds.length > 0) {
    const updated = await db
      .update(groupInvitations)
      .set({ status: "rejected", decidedAt: now })
      .where(inArray(groupInvitations.id, groupInvIds.map((r) => r.id)))
      .returning({ id: groupInvitations.id });
    groupInvitationsRejected = updated.length;
  }

  return { friendshipsRejected, groupInvitationsRejected };
}
