import type { Database } from "@/server/db/client";
import { groupLinks, groupMemberships, groups } from "@/server/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

/**
 * Capacidades / invariantes del dominio de grupos. Estas constantes
 * son hardcoded por ahora; si en producción detectamos casos de
 * uso que las superen, las pasamos a env vars sin tocar callers.
 */

/** Máximo de grupos activos (no abandonados) por user. */
export const MAX_GROUPS_PER_USER = 3;

/** Máximo de links de invitación activos (no revocados) por grupo. */
export const MAX_LINKS_PER_GROUP = 5;

/** Rango configurable del cap de miembros del grupo. */
export const GROUP_MEMBERS_MIN = 5;
export const GROUP_MEMBERS_MAX = 100;
export const GROUP_MEMBERS_DEFAULT = 25;

/**
 * Devuelve el número de grupos en los que el user es miembro activo
 * (membership con `left_at IS NULL`). Cuenta admin + member por igual.
 * Usado antes de aceptar invitación / crear grupo / unirse vía link.
 */
export async function countActiveGroupsForUser(db: Database, userId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(
      and(
        eq(groupMemberships.userId, userId),
        isNull(groupMemberships.leftAt),
        isNull(groups.deletedAt),
      ),
    );
  return rows[0]?.total ?? 0;
}

/** Cuenta miembros activos de un grupo (excluye ex-miembros congelados). */
export async function countActiveMembers(db: Database, groupId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, groupId), isNull(groupMemberships.leftAt)));
  return rows[0]?.total ?? 0;
}

/** Cuenta links activos (no revocados, no agotados) de un grupo. */
export async function countActiveLinks(db: Database, groupId: string): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`count(*) FILTER (WHERE ${groupLinks.revokedAt} IS NULL AND (${groupLinks.maxUses} = 0 OR ${groupLinks.uses} < ${groupLinks.maxUses}))::int`,
    })
    .from(groupLinks)
    .where(eq(groupLinks.groupId, groupId));
  return rows[0]?.total ?? 0;
}

export type CapCheck = { ok: true } | { ok: false; reason: string };

/**
 * Verifica que el user puede unirse a un grupo más. Devuelve el
 * resultado en shape consumible por `GroupActionResult`.
 */
export async function canJoinAnotherGroup(db: Database, userId: string): Promise<CapCheck> {
  const count = await countActiveGroupsForUser(db, userId);
  if (count >= MAX_GROUPS_PER_USER) {
    return {
      ok: false,
      reason: `Has alcanzado el máximo de ${MAX_GROUPS_PER_USER} grupos activos`,
    };
  }
  return { ok: true };
}

/**
 * Verifica que el grupo tiene espacio para un miembro más, contra
 * su `max_members` configurado.
 */
export async function hasRoomForOneMore(
  db: Database,
  groupId: string,
  maxMembers: number,
): Promise<CapCheck> {
  const count = await countActiveMembers(db, groupId);
  if (count >= maxMembers) {
    return { ok: false, reason: "El grupo está lleno" };
  }
  return { ok: true };
}

/** Verifica el cap de links activos antes de crear uno nuevo. */
export async function canCreateAnotherLink(db: Database, groupId: string): Promise<CapCheck> {
  const count = await countActiveLinks(db, groupId);
  if (count >= MAX_LINKS_PER_GROUP) {
    return {
      ok: false,
      reason: `Has alcanzado el máximo de ${MAX_LINKS_PER_GROUP} links activos para este grupo`,
    };
  }
  return { ok: true };
}
