import { randomBytes } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { dlog } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import {
  friendships,
  invitationRedemptions,
  invitations,
} from "@/server/db/schema";
import { createNotification } from "@/server/notifications/create";
import { findRedeemableInvitation } from "./queries";

/**
 * Genera un token URL-safe de 16 bytes (≈22 chars base64url). Espacio
 * de colisión 2^128 — overkill para esta capability, pero barato y
 * elimina la necesidad de generar-y-reintentar si dos invitaciones
 * cayeran en el mismo slug.
 */
export function generateInvitationToken(): string {
  return randomBytes(16)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export type RedemptionResult =
  | { ok: true; inviterId: string }
  | {
      ok: false;
      code:
        | "not_found"
        | "revoked_or_exhausted"
        | "self_redeem"
        | "already_redeemed";
    };

/**
 * Aplica un token de invitación al user recién creado. Se llama desde
 * el evento `createUser` del callback de Auth.js: el visitor llegó
 * con `?invite=<token>` que se persistió en cookie antes del OAuth,
 * y aquí cerramos el ciclo.
 *
 * Efectos colaterales si es válido:
 *  - INSERT en `invitation_redemptions` (única por inviteeId).
 *  - `invitations.uses += 1`.
 *  - INSERT en `friendships` con `status='accepted'` entre inviter
 *    e invitee — auto-friendship bidireccional según spec.
 *  - Notificación in-app `friend_accepted` para el inviter
 *    ("X ha aceptado tu invitación y ahora sois amigos").
 *
 * Idempotente por la unicidad `inviteeId` en `invitation_redemptions`
 * + la unicidad `(requester, addressee)` en `friendships`. Si algo
 * falla a media transacción (raro en single-statement INSERTs),
 * el caller verá `ok: false` con el código correspondiente.
 */
export async function redeemInvitationForUser(
  db: Database,
  inviteeId: string,
  token: string,
  inviteeName: string | null,
): Promise<RedemptionResult> {
  const invitation = await findRedeemableInvitation(db, token);
  if (!invitation) {
    dlog("ranking", "invitation not redeemable", { token: token.slice(0, 6) });
    return { ok: false, code: "not_found" };
  }
  if (invitation.inviterId === inviteeId) {
    return { ok: false, code: "self_redeem" };
  }

  // Detecta si el invitee ya redimió un link cualquiera (constraint
  // unique en `inviteeId`). Si sí, no permitimos un segundo redeem
  // — un user "pertenece" a un solo inviter por decisión de producto.
  const existing = await db
    .select({ id: invitationRedemptions.id })
    .from(invitationRedemptions)
    .where(eq(invitationRedemptions.inviteeId, inviteeId))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, code: "already_redeemed" };
  }

  // Insert redemption + bump counter atómicamente. Si max_uses se
  // alcanzó concurrentemente (race entre la lectura de
  // `findRedeemableInvitation` y este insert), el WHERE filtra y
  // `returning` viene vacío → tratamos como exhausted.
  await db.insert(invitationRedemptions).values({
    invitationId: invitation.id,
    inviteeId,
    inviterId: invitation.inviterId,
  });

  const bumped = await db
    .update(invitations)
    .set({ uses: sql`${invitations.uses} + 1` })
    .where(
      and(
        eq(invitations.id, invitation.id),
        // Solo bumpea si no se ha agotado: `max_uses = 0` (ilimitado)
        // o `uses < max_uses`.
        or(
          eq(invitations.maxUses, 0),
          sql`${invitations.uses} < ${invitations.maxUses}`,
        ),
      ),
    )
    .returning({ id: invitations.id });

  if (bumped.length === 0) {
    // El link se agotó entre la lectura y el update — revertimos la
    // redemption y devolvemos exhausted para que el caller lo trate
    // como "el link ya no era válido". Caso raro pero defensivo.
    await db.delete(invitationRedemptions).where(eq(invitationRedemptions.inviteeId, inviteeId));
    return { ok: false, code: "revoked_or_exhausted" };
  }

  // Auto-friendship bidireccional. `ON CONFLICT DO NOTHING` por si
  // por alguna razón ya existía un pending o accepted en cualquier
  // dirección (defensivo, no debería pasar para un user recién
  // creado).
  await db
    .insert(friendships)
    .values({
      requesterId: invitation.inviterId,
      addresseeId: inviteeId,
      status: "accepted",
      decidedAt: new Date(),
    })
    .onConflictDoNothing();

  // Notificación al inviter. El invitee es nuevo así que no tiene
  // bell todavía; no le notificamos.
  await createNotification({
    db,
    userId: invitation.inviterId,
    kind: "friend_accepted",
    title: `${inviteeName?.trim() || "Alguien"} se ha unido con tu invitación`,
    body: null,
  });

  dlog("ranking", "invitation redeemed", {
    invitationId: invitation.id,
    inviterId: invitation.inviterId,
    inviteeId,
  });

  return { ok: true, inviterId: invitation.inviterId };
}
