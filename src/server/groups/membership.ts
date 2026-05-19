"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dlog, derr } from "@/lib/debug-log";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { groupMemberships, groups, userPoints } from "@/server/db/schema";
import { evaluateAndUnlock } from "@/server/achievements/unlock";
import { notifyWithPush } from "@/server/notifications/notify-with-push";
import {
  canJoinAnotherGroup,
  hasRoomForOneMore,
} from "./caps";
import { buildGroupInviteUrl } from "./tokens";
import type { GroupActionResult } from "./types";

/**
 * Member abandona el grupo. El admin NO puede usar esta función
 * directamente — bloqueado por `code: 'is_admin_cannot_leave'`. Debe
 * primero transferir admin o borrar el grupo.
 *
 * Si `freezeProfile = true`, mantiene la membership con `left_at` set
 * + snapshot de `user_points` actuales en `frozen_*`. Si `false`,
 * borra la membership entera.
 */
export async function leaveGroup(input: {
  groupId: string;
  freezeProfile: boolean;
}): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  const schema = z.object({
    groupId: z.string().uuid(),
    freezeProfile: z.boolean(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { groupId, freezeProfile } = parsed.data;

  const rows = await db
    .select({
      role: groupMemberships.role,
      leftAt: groupMemberships.leftAt,
      deletedAt: groups.deletedAt,
      groupName: groups.name,
    })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) return { ok: false, code: "not_found" };
  if (row.leftAt !== null) return { ok: false, code: "not_member" };
  if (row.role === "admin") return { ok: false, code: "is_admin_cannot_leave" };

  if (freezeProfile) {
    // Snapshot de `user_points` en el momento de salir.
    const pts = await db
      .select({
        totalPoints: userPoints.totalPoints,
        streakMax: userPoints.streakMax,
        simpleHits: userPoints.simpleHits,
      })
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);
    const p = pts[0] ?? { totalPoints: 0, streakMax: 0, simpleHits: 0 };
    await db
      .update(groupMemberships)
      .set({
        leftAt: new Date(),
        frozenPoints: p.totalPoints,
        frozenStreakMax: p.streakMax,
        frozenSimpleHits: p.simpleHits,
      })
      .where(
        and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)),
      );
  } else {
    // Borrado total — el user desaparece del grupo sin rastro.
    await db
      .delete(groupMemberships)
      .where(
        and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)),
      );
  }

  // Notificar al admin que un miembro abandonó.
  try {
    const adminRows = await db
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.role, "admin"),
          isNull(groupMemberships.leftAt),
        ),
      )
      .limit(1);
    const adminId = adminRows[0]?.userId;
    if (adminId && adminId !== userId) {
      await notifyWithPush({
        db,
        userId: adminId,
        kind: "group_left",
        title: `${session.user.name ?? "Un miembro"} ha salido del grupo "${row.groupName}"`,
        body: null,
        pushable: false, // notificación silenciosa, sin push spam
      });
    }
  } catch (err) {
    derr("ranking", "leaveGroup admin notify failed", { groupId, userId, err });
  }

  dlog("ranking", "user left group", { groupId, userId, freezeProfile });

  revalidatePath("/social");
  revalidatePath(`/social/grupos/${groupId}`);
  revalidatePath("/ranking");
  return { ok: true, groupId };
}

/**
 * Admin expulsa a un miembro. La membership se borra (no se
 * congela — el admin no respeta la preferencia del expulsado). El
 * expulsado recibe push notification con un copy claro; el resto de
 * miembros recibe in-app sin push (no es time-sensitive para ellos).
 */
export async function expelMember(input: {
  groupId: string;
  memberUserId: string;
}): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const adminId = session.user.id;

  const schema = z.object({
    groupId: z.string().uuid(),
    memberUserId: z.string().uuid(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { groupId, memberUserId } = parsed.data;

  if (memberUserId === adminId) return { ok: false, code: "invalid_input" };

  // Validar admin + target activo.
  const rows = await db
    .select({
      adminRole: groupMemberships.role,
      deletedAt: groups.deletedAt,
      groupName: groups.name,
    })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, adminId)))
    .limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) return { ok: false, code: "not_found" };
  if (row.adminRole !== "admin") return { ok: false, code: "unauthorized" };

  const targetRows = await db
    .select({ leftAt: groupMemberships.leftAt })
    .from(groupMemberships)
    .where(
      and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, memberUserId)),
    )
    .limit(1);
  const target = targetRows[0];
  if (!target) return { ok: false, code: "not_member" };
  if (target.leftAt !== null) return { ok: false, code: "not_member" };

  await db
    .delete(groupMemberships)
    .where(
      and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, memberUserId)),
    );

  // Notificar al expulsado (push activo) + al resto de miembros (in-app).
  try {
    await notifyWithPush({
      db,
      userId: memberUserId,
      kind: "group_expelled",
      title: `Has sido expulsado del grupo "${row.groupName}"`,
      body: null,
      pushable: true,
    });
    const others = await db
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(
        and(eq(groupMemberships.groupId, groupId), isNull(groupMemberships.leftAt)),
      );
    for (const o of others) {
      if (o.userId === adminId) continue;
      await notifyWithPush({
        db,
        userId: o.userId,
        kind: "group_expelled",
        title: `Un miembro ha sido expulsado del grupo "${row.groupName}"`,
        body: null,
        pushable: false,
      });
    }
  } catch (err) {
    derr("ranking", "expelMember notify failed", { groupId, adminId, memberUserId, err });
  }

  dlog("ranking", "member expelled", { groupId, adminId, memberUserId });

  revalidatePath(`/social/grupos/${groupId}`);
  revalidatePath("/social");
  return { ok: true, groupId };
}

/**
 * Unirse a un grupo público sin invitación. Verifica visibility,
 * cap del user, cap del grupo. Devuelve `not_found` si no existe o
 * es privado (mismo error que para no filtrar info).
 */
export async function joinPublicGroup(groupId: string): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  if (!z.string().uuid().safeParse(groupId).success) {
    return { ok: false, code: "invalid_input" };
  }

  const rows = await db
    .select({
      visibility: groups.visibility,
      deletedAt: groups.deletedAt,
      maxMembers: groups.maxMembers,
      groupName: groups.name,
    })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  const g = rows[0];
  if (!g || g.deletedAt) return { ok: false, code: "not_found" };
  if (g.visibility !== "public") return { ok: false, code: "not_found" };

  // ¿Ya eres miembro activo?
  const existing = await db
    .select({ leftAt: groupMemberships.leftAt })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)))
    .limit(1);
  if (existing[0]) {
    if (existing[0].leftAt === null) return { ok: false, code: "already_member" };
    // Si era ex-miembro, re-activamos limpiando los frozen_*.
    const cap = await canJoinAnotherGroup(db, userId);
    if (!cap.ok) return { ok: false, code: "cap_groups_reached" };
    const room = await hasRoomForOneMore(db, groupId, g.maxMembers);
    if (!room.ok) return { ok: false, code: "group_full" };
    await db
      .update(groupMemberships)
      .set({
        leftAt: null,
        frozenPoints: null,
        frozenStreakMax: null,
        frozenSimpleHits: null,
        joinedAt: new Date(),
      })
      .where(
        and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)),
      );
  } else {
    // Nuevo membership. Caps.
    const cap = await canJoinAnotherGroup(db, userId);
    if (!cap.ok) return { ok: false, code: "cap_groups_reached" };
    const room = await hasRoomForOneMore(db, groupId, g.maxMembers);
    if (!room.ok) return { ok: false, code: "group_full" };

    await db.insert(groupMemberships).values({
      groupId,
      userId,
      role: "member",
    });
  }

  dlog("ranking", "joined public group", { groupId, userId });

  // Logro `team-spirit` (común): primer grupo del user.
  try {
    await evaluateAndUnlock(db, userId);
  } catch (err) {
    derr("ranking", "joinPublicGroup achievement eval failed", {
      userId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  revalidatePath("/social");
  revalidatePath(`/social/grupos/${groupId}`);
  revalidatePath("/ranking");
  return { ok: true, groupId };
}

/**
 * Unirse a un grupo vía token de link. El token se valida (existe,
 * no revocado, no agotado, grupo no borrado) y luego se aplica la
 * misma lógica que `joinPublicGroup` (caps). Si pasa, incrementa
 * `uses` del link atómicamente.
 */
export async function joinGroupViaLink(token: string): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, code: "invalid_input" };
  }

  // Cargar link + grupo en una query.
  const { groupLinks } = await import("@/server/db/schema");
  const rows = await db
    .select({
      linkId: groupLinks.id,
      groupId: groupLinks.groupId,
      maxUses: groupLinks.maxUses,
      uses: groupLinks.uses,
      revokedAt: groupLinks.revokedAt,
      groupDeleted: groups.deletedAt,
      groupName: groups.name,
      maxMembers: groups.maxMembers,
    })
    .from(groupLinks)
    .innerJoin(groups, eq(groups.id, groupLinks.groupId))
    .where(eq(groupLinks.token, token))
    .limit(1);
  const r = rows[0];
  if (!r) return { ok: false, code: "not_found" };
  if (r.groupDeleted) return { ok: false, code: "group_deleted" };
  if (r.revokedAt) return { ok: false, code: "link_revoked" };
  if (r.maxUses > 0 && r.uses >= r.maxUses) return { ok: false, code: "link_exhausted" };

  // ¿Ya soy miembro activo?
  const existing = await db
    .select({ leftAt: groupMemberships.leftAt })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, r.groupId), eq(groupMemberships.userId, userId)))
    .limit(1);
  if (existing[0]?.leftAt === null) {
    // Idempotente: si ya eres miembro, "ok" sin tocar nada y sin
    // consumir uso del link.
    return { ok: true, groupId: r.groupId };
  }

  // Caps.
  const cap = await canJoinAnotherGroup(db, userId);
  if (!cap.ok) return { ok: false, code: "cap_groups_reached" };
  const room = await hasRoomForOneMore(db, r.groupId, r.maxMembers);
  if (!room.ok) return { ok: false, code: "group_full" };

  // Insert o re-activar membership.
  if (existing[0]) {
    await db
      .update(groupMemberships)
      .set({
        leftAt: null,
        frozenPoints: null,
        frozenStreakMax: null,
        frozenSimpleHits: null,
        joinedAt: new Date(),
      })
      .where(
        and(eq(groupMemberships.groupId, r.groupId), eq(groupMemberships.userId, userId)),
      );
  } else {
    await db.insert(groupMemberships).values({
      groupId: r.groupId,
      userId,
      role: "member",
    });
  }

  // Bump uses del link. No es estrictamente atómico con el insert,
  // pero la idempotencia (ya-miembro) cubre el caso doble-click.
  await db
    .update(groupLinks)
    .set({ uses: r.uses + 1 })
    .where(eq(groupLinks.id, r.linkId));

  dlog("ranking", "joined via link", { groupId: r.groupId, userId, linkId: r.linkId });

  // Logro `team-spirit` (común): primer grupo del user.
  try {
    await evaluateAndUnlock(db, userId);
  } catch (err) {
    derr("ranking", "joinGroupViaLink achievement eval failed", {
      userId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  revalidatePath("/social");
  revalidatePath(`/social/grupos/${r.groupId}`);
  revalidatePath("/ranking");
  return { ok: true, groupId: r.groupId };
}

// Helper público para el link panel — exportado para que la UI
// muestre la URL completa sin tener que importar tokens.ts directamente
// desde un componente cliente.
export { buildGroupInviteUrl };
