"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dlog } from "@/lib/debug-log";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { groupLinks, groupMemberships, groups } from "@/server/db/schema";
import { canCreateAnotherLink } from "./caps";
import { buildGroupInviteUrl, generateGroupLinkToken } from "./tokens";
import type { GroupActionResult } from "./types";

const createLinkSchema = z.object({
  groupId: z.string().uuid(),
  /** 0 = ilimitado. Cap N concreto si admin quiere reutilización limitada. */
  maxUses: z.number().int().min(0).max(1000).default(0),
});

/**
 * Admin crea un link de invitación reutilizable. Cap 5 links activos
 * (no revocados) por grupo — el admin debe revocar uno antes de crear
 * otro si llega al cap. El token se genera server-side y nunca viaja
 * en el input (evita que un caller intente forzar tokens conocidos).
 */
export async function createGroupLink(
  input: z.infer<typeof createLinkSchema>,
): Promise<GroupActionResult & { token?: string; url?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  const parsed = createLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { groupId, maxUses } = parsed.data;

  const rows = await db
    .select({
      role: groupMemberships.role,
      deletedAt: groups.deletedAt,
    })
    .from(groups)
    .innerJoin(groupMemberships, eq(groupMemberships.groupId, groups.id))
    .where(
      and(
        eq(groups.id, groupId),
        eq(groupMemberships.userId, userId),
        isNull(groupMemberships.leftAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) return { ok: false, code: "not_found" };
  if (row.role !== "admin") return { ok: false, code: "unauthorized" };

  const cap = await canCreateAnotherLink(db, groupId);
  if (!cap.ok) return { ok: false, code: "cap_links_reached" };

  // Generar token único. La columna `token` es UNIQUE; en el caso
  // teóricamente improbable de colisión, retrying una vez basta.
  // No protegemos contra collisions de 2^128 con loops infinitos.
  const token = generateGroupLinkToken();

  await db.insert(groupLinks).values({
    groupId,
    token,
    maxUses,
  });

  dlog("ranking", "group link created", { groupId, userId, maxUses });

  revalidatePath(`/social/grupos/${groupId}`);
  return { ok: true, groupId, token, url: buildGroupInviteUrl(token) };
}

const revokeLinkSchema = z.object({
  linkId: z.string().uuid(),
});

/**
 * Admin revoca un link. Marca `revoked_at`. Cualquier uso posterior
 * del token se rechaza en `joinGroupViaLink` con `link_revoked`. No se
 * borra para que el log de auditoría quede preservado (en algún
 * futuro podemos exponerlo).
 */
export async function revokeGroupLink(
  input: z.infer<typeof revokeLinkSchema>,
): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  const parsed = revokeLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { linkId } = parsed.data;

  const rows = await db
    .select({
      groupId: groupLinks.groupId,
      revokedAt: groupLinks.revokedAt,
      adminRole: groupMemberships.role,
      adminLeftAt: groupMemberships.leftAt,
    })
    .from(groupLinks)
    .leftJoin(
      groupMemberships,
      and(
        eq(groupMemberships.groupId, groupLinks.groupId),
        eq(groupMemberships.userId, userId),
      ),
    )
    .where(eq(groupLinks.id, linkId))
    .limit(1);
  const link = rows[0];
  if (!link) return { ok: false, code: "not_found" };
  if (link.adminRole !== "admin" || link.adminLeftAt !== null) {
    return { ok: false, code: "unauthorized" };
  }
  if (link.revokedAt) {
    // Idempotente.
    return { ok: true, groupId: link.groupId };
  }

  await db.update(groupLinks).set({ revokedAt: new Date() }).where(eq(groupLinks.id, linkId));

  dlog("ranking", "group link revoked", { linkId, groupId: link.groupId, userId });

  revalidatePath(`/social/grupos/${link.groupId}`);
  return { ok: true, groupId: link.groupId };
}
