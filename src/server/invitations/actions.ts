"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { dlog } from "@/lib/debug-log";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { invitations } from "@/server/db/schema";
import { generateInvitationToken } from "./redemption";

export type CreateInvitationResult =
  | { ok: true; token: string; url: string }
  | { ok: false; code: "unauthorized" | "limit_reached" | "invalid_input" };

const MAX_ACTIVE_LINKS = 5;

/**
 * Genera un link de invitación. Cap defensivo a 5 links activos
 * por user para evitar abuso (spam de tokens generados sin uso).
 * Links revocados no cuentan — el user puede "rotar" su link
 * libremente.
 *
 * `maxUses` 0 = ilimitado; cualquier número positivo limita los
 * redeems totales.
 */
export async function createInvitation(
  maxUses: number,
): Promise<CreateInvitationResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  if (!Number.isInteger(maxUses) || maxUses < 0 || maxUses > 100) {
    return { ok: false, code: "invalid_input" };
  }
  const userId = session.user.id;

  // Cap solo a links NO revocados — el user puede rotar libremente
  // sin quedar bloqueado por links viejos que ya cortó. COUNT(*) en
  // BD para no traer filas innecesarias.
  const countRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invitations)
    .where(and(eq(invitations.inviterId, userId), isNull(invitations.revokedAt)));
  const liveCount = countRows[0]?.n ?? 0;
  if (liveCount >= MAX_ACTIVE_LINKS) {
    return { ok: false, code: "limit_reached" };
  }

  const token = generateInvitationToken();
  await db.insert(invitations).values({
    inviterId: userId,
    token,
    maxUses,
  });

  dlog("ranking", "invitation created", { userId, maxUses });
  revalidatePath("/amigos/invitar");

  // Construimos la URL en el client-side via buildInvitationUrl —
  // aquí devolvemos también el host para que el botón "Copiar" no
  // tenga que reconstruirla.
  const { buildInvitationUrl } = await import("./queries");
  return { ok: true, token, url: buildInvitationUrl(token) };
}

export type RevokeInvitationResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "not_found" };

/**
 * Rescinde un link: pone `revoked_at = now()` si pertenece al user.
 * No borra la fila para conservar histórico de redenciones pasadas;
 * solo lo marca como no-redimible.
 */
export async function revokeInvitation(
  invitationId: string,
): Promise<RevokeInvitationResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };

  const rows = await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.inviterId, session.user.id),
      ),
    )
    .returning({ id: invitations.id });

  if (rows.length === 0) return { ok: false, code: "not_found" };

  dlog("ranking", "invitation revoked", {
    userId: session.user.id,
    invitationId,
  });
  revalidatePath("/amigos/invitar");
  return { ok: true };
}
