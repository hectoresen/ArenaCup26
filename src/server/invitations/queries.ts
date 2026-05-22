import { env } from "@/lib/env";
import type { Database } from "@/server/db/client";
import { invitationRedemptions, invitations } from "@/server/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import type { InvitationListItem } from "./types";

/**
 * Construye la URL pública para un token de invitación. Centralizado
 * aquí para que cualquier consumer (UI de listado, server logs, share
 * helpers) emita exactamente el mismo formato.
 */
export function buildInvitationUrl(token: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/?invite=${encodeURIComponent(token)}`;
}

/** Carga todos los links de un user, más recientes primero. */
export async function getInvitations(db: Database, userId: string): Promise<InvitationListItem[]> {
  const rows = await db
    .select({
      id: invitations.id,
      token: invitations.token,
      maxUses: invitations.maxUses,
      uses: invitations.uses,
      revokedAt: invitations.revokedAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(eq(invitations.inviterId, userId))
    .orderBy(desc(invitations.createdAt));

  return rows.map((row) => ({
    id: row.id,
    token: row.token,
    url: buildInvitationUrl(row.token),
    maxUses: row.maxUses,
    uses: row.uses,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  }));
}

/**
 * Decide si un link sigue siendo redimible (no revocado, no agotado,
 * y el token existe). Pure check; no marca nada en BD.
 */
export type RedeemableInvitation = {
  id: string;
  inviterId: string;
};

export async function findRedeemableInvitation(
  db: Database,
  token: string,
): Promise<RedeemableInvitation | null> {
  const rows = await db
    .select({
      id: invitations.id,
      inviterId: invitations.inviterId,
      maxUses: invitations.maxUses,
      uses: invitations.uses,
      revokedAt: invitations.revokedAt,
    })
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.maxUses > 0 && row.uses >= row.maxUses) return null;
  return { id: row.id, inviterId: row.inviterId };
}

/**
 * Counter de redenciones recibidas — el inviter ve "tus invitados".
 * Útil para mostrar "X amigos invitados" en la sección de
 * invitaciones de `/amigos`.
 */
export async function countRedeemedInvitations(db: Database, inviterId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(invitationRedemptions)
    .where(eq(invitationRedemptions.inviterId, inviterId));
  return rows[0]?.total ?? 0;
}
