"use server";

import { auth } from "@/lib/auth";
import { derr, dlog } from "@/lib/debug-log";
import { evaluateAndUnlock } from "@/server/achievements/unlock";
import { assertNotInMaintenance } from "@/server/admin/maintenance-guard";
import { db } from "@/server/db/client";
import { friendships, groupInvitations, groupMemberships, groups, users } from "@/server/db/schema";
import { notifyWithPush } from "@/server/notifications/notify-with-push";
import { and, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canJoinAnotherGroup, hasRoomForOneMore } from "./caps";
import type { GroupActionResult } from "./types";

/**
 * Admin invita a otro user a un grupo. Reglas:
 *  - Solo admin del grupo puede invitar (member no, por simplicidad).
 *  - El invitee debe existir.
 *  - No puede invitarse a sí mismo.
 *  - Si ya hay una invitación `pending` (group, invitee), idempotente
 *    devuelve `ok` sin crear duplicado.
 *  - Si el invitee ya es miembro activo → `already_member`.
 *  - El grupo no puede estar borrado.
 *  - La invitación se acepta/rechaza desde el panel del invitee; en
 *    ambos casos la fila queda persistida (status = accepted/rejected).
 */
const createInvitationSchema = z.object({
  groupId: z.string().uuid(),
  inviteeId: z.string().uuid(),
});

export async function createGroupInvitation(
  input: z.infer<typeof createInvitationSchema>,
): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  await assertNotInMaintenance();
  const inviterId = session.user.id;

  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { groupId, inviteeId } = parsed.data;
  if (inviteeId === inviterId) return { ok: false, code: "invalid_input" };

  // El inviter es admin activo + el grupo existe.
  const adminRows = await db
    .select({
      role: groupMemberships.role,
      deletedAt: groups.deletedAt,
      groupName: groups.name,
    })
    .from(groups)
    .innerJoin(groupMemberships, eq(groupMemberships.groupId, groups.id))
    .where(
      and(
        eq(groups.id, groupId),
        eq(groupMemberships.userId, inviterId),
        isNull(groupMemberships.leftAt),
      ),
    )
    .limit(1);
  const adminRow = adminRows[0];
  if (!adminRow || adminRow.deletedAt) return { ok: false, code: "not_found" };
  if (adminRow.role !== "admin") return { ok: false, code: "unauthorized" };

  // El invitee existe.
  const invRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, inviteeId))
    .limit(1);
  if (!invRows[0]) return { ok: false, code: "not_found" };

  // ¿Ya es miembro activo?
  const memberRows = await db
    .select({ leftAt: groupMemberships.leftAt })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, inviteeId)))
    .limit(1);
  if (memberRows[0]?.leftAt === null) return { ok: false, code: "already_member" };

  // ¿Hay ya una invitación pending? Idempotente — re-notificamos al
  // invitee pero no duplicamos la fila.
  const pendingRows = await db
    .select({ id: groupInvitations.id })
    .from(groupInvitations)
    .where(
      and(
        eq(groupInvitations.groupId, groupId),
        eq(groupInvitations.inviteeId, inviteeId),
        eq(groupInvitations.status, "pending"),
      ),
    )
    .limit(1);
  if (pendingRows[0]) {
    dlog("ranking", "invitation already pending", { groupId, inviteeId });
    return { ok: true, groupId };
  }

  await db.insert(groupInvitations).values({
    groupId,
    invitedBy: inviterId,
    inviteeId,
    status: "pending",
  });

  try {
    await notifyWithPush({
      db,
      userId: inviteeId,
      kind: "group_invited",
      title: `Te han invitado al grupo "${adminRow.groupName}"`,
      body: null,
      pushable: true,
    });
  } catch (err) {
    derr("ranking", "createGroupInvitation notify failed", { groupId, inviteeId, err });
  }

  dlog("ranking", "group invitation created", { groupId, inviterId, inviteeId });

  revalidatePath("/social");
  revalidatePath(`/social/grupos/${groupId}`);
  return { ok: true, groupId };
}

const decideInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

/**
 * El invitee acepta la invitación. Valida que está dirigida a él y
 * que está pending. Verifica caps del user y del grupo en el momento
 * de aceptación (no en el momento de invitar — el grupo puede haberse
 * llenado mientras tanto). Inserta membership y notifica al admin +
 * resto de miembros.
 */
export async function acceptGroupInvitation(
  input: z.infer<typeof decideInvitationSchema>,
): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  await assertNotInMaintenance();
  const userId = session.user.id;

  const parsed = decideInvitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { invitationId } = parsed.data;

  const rows = await db
    .select({
      inviteeId: groupInvitations.inviteeId,
      status: groupInvitations.status,
      groupId: groupInvitations.groupId,
      groupDeletedAt: groups.deletedAt,
      groupMaxMembers: groups.maxMembers,
      groupName: groups.name,
    })
    .from(groupInvitations)
    .innerJoin(groups, eq(groups.id, groupInvitations.groupId))
    .where(eq(groupInvitations.id, invitationId))
    .limit(1);
  const inv = rows[0];
  if (!inv) return { ok: false, code: "not_found" };
  if (inv.inviteeId !== userId) return { ok: false, code: "unauthorized" };
  if (inv.status !== "pending") return { ok: false, code: "invitation_not_pending" };
  if (inv.groupDeletedAt) return { ok: false, code: "group_deleted" };

  // Caps al momento de aceptar.
  const cap = await canJoinAnotherGroup(db, userId);
  if (!cap.ok) return { ok: false, code: "cap_groups_reached" };
  const room = await hasRoomForOneMore(db, inv.groupId, inv.groupMaxMembers);
  if (!room.ok) return { ok: false, code: "group_full" };

  // Si era ex-miembro (left_at != null), re-activamos. Si nunca lo fue,
  // insertamos.
  const existing = await db
    .select({ leftAt: groupMemberships.leftAt })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, inv.groupId), eq(groupMemberships.userId, userId)))
    .limit(1);
  if (existing[0]?.leftAt === null) {
    // Ya es miembro activo (raro: race entre invitar y aceptar).
    // Igual marcamos la invitación como accepted para limpiar.
    await db
      .update(groupInvitations)
      .set({ status: "accepted", decidedAt: new Date() })
      .where(eq(groupInvitations.id, invitationId));
    return { ok: true, groupId: inv.groupId };
  }
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
      .where(and(eq(groupMemberships.groupId, inv.groupId), eq(groupMemberships.userId, userId)));
  } else {
    await db.insert(groupMemberships).values({
      groupId: inv.groupId,
      userId,
      role: "member",
    });
  }

  await db
    .update(groupInvitations)
    .set({ status: "accepted", decidedAt: new Date() })
    .where(eq(groupInvitations.id, invitationId));

  // Notificar al admin del grupo de que un nuevo miembro entró.
  try {
    const adminRows = await db
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, inv.groupId),
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
        kind: "group_joined",
        title: `${session.user.name ?? "Un miembro"} se ha unido al grupo "${inv.groupName}"`,
        body: null,
        pushable: false,
      });
    }
  } catch (err) {
    derr("ranking", "acceptGroupInvitation notify failed", {
      groupId: inv.groupId,
      userId,
      err,
    });
  }

  // Logro `team-spirit` (común): el invitee se ha unido a su primer grupo.
  try {
    await evaluateAndUnlock(db, userId);
  } catch (err) {
    derr("ranking", "acceptGroupInvitation achievement eval failed", {
      userId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  dlog("ranking", "group invitation accepted", { invitationId, groupId: inv.groupId, userId });

  revalidatePath("/social");
  revalidatePath(`/social/grupos/${inv.groupId}`);
  revalidatePath("/ranking");
  return { ok: true, groupId: inv.groupId };
}

/**
 * El invitee rechaza la invitación. Marca como rejected — no se borra
 * para mantener histórico (y evitar spam si el admin re-intenta:
 * podemos en el futuro añadir cooldown en `createGroupInvitation` si
 * vemos abusos, pero hoy no es un problema).
 */
export async function rejectGroupInvitation(
  input: z.infer<typeof decideInvitationSchema>,
): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  await assertNotInMaintenance();
  const userId = session.user.id;

  const parsed = decideInvitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { invitationId } = parsed.data;

  const rows = await db
    .select({
      inviteeId: groupInvitations.inviteeId,
      status: groupInvitations.status,
      groupId: groupInvitations.groupId,
    })
    .from(groupInvitations)
    .where(eq(groupInvitations.id, invitationId))
    .limit(1);
  const inv = rows[0];
  if (!inv) return { ok: false, code: "not_found" };
  if (inv.inviteeId !== userId) return { ok: false, code: "unauthorized" };
  if (inv.status !== "pending") return { ok: false, code: "invitation_not_pending" };

  await db
    .update(groupInvitations)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(eq(groupInvitations.id, invitationId));

  dlog("ranking", "group invitation rejected", { invitationId, groupId: inv.groupId, userId });

  revalidatePath("/social");
  return { ok: true, groupId: inv.groupId };
}

/**
 * Admin cancela una invitación que él envió. Se marca como rejected
 * (mismo estado terminal, el motivo es indistinguible del rechazo del
 * invitee desde la BD — si quisiéramos diferenciarlo, añadiríamos un
 * estado `cancelled`).
 */
export async function cancelGroupInvitation(
  input: z.infer<typeof decideInvitationSchema>,
): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  await assertNotInMaintenance();
  const userId = session.user.id;

  const parsed = decideInvitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { invitationId } = parsed.data;

  const rows = await db
    .select({
      groupId: groupInvitations.groupId,
      status: groupInvitations.status,
      invitedBy: groupInvitations.invitedBy,
      adminRole: groupMemberships.role,
      adminLeftAt: groupMemberships.leftAt,
    })
    .from(groupInvitations)
    .leftJoin(
      groupMemberships,
      and(
        eq(groupMemberships.groupId, groupInvitations.groupId),
        eq(groupMemberships.userId, userId),
      ),
    )
    .where(eq(groupInvitations.id, invitationId))
    .limit(1);
  const inv = rows[0];
  if (!inv) return { ok: false, code: "not_found" };
  if (inv.status !== "pending") return { ok: false, code: "invitation_not_pending" };
  // Quien puede cancelar: el inviter original O el admin actual del grupo
  // (puede haber transferred admin entre invitación y cancelación).
  const isInviter = inv.invitedBy === userId;
  const isAdmin = inv.adminRole === "admin" && inv.adminLeftAt === null;
  if (!isInviter && !isAdmin) return { ok: false, code: "unauthorized" };

  await db
    .update(groupInvitations)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(eq(groupInvitations.id, invitationId));

  dlog("ranking", "group invitation cancelled", { invitationId, groupId: inv.groupId, userId });

  revalidatePath(`/social/grupos/${inv.groupId}`);
  return { ok: true, groupId: inv.groupId };
}

/**
 * Helper para la UI del invitador: devuelve los amigos del user
 * actual que NO están ya en el grupo ni tienen invitación pending. Se
 * usa en el modal "Invitar amigo" para mostrar candidatos. Esto vive
 * en el módulo de invitations.ts porque es donde mejor encaja
 * lógicamente; en queries.ts está la lógica de listar grupos.
 *
 * Nota: solo lo llaman server components, no es una server action.
 * No requiere "use server" pero al estar en este archivo se compila
 * como tal — está OK porque las acciones son las que se exportan
 * como actions; las funciones que devuelven datos puros se usan
 * server-side normalmente.
 */
export async function getFriendsAvailableToInvite(groupId: string): Promise<
  Array<{
    id: string;
    name: string | null;
    username: string | null;
    avatarId: string | null;
    image: string | null;
  }>
> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  // Friends del user actual (status accepted, en cualquier dirección).
  const allFriends = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      avatarId: users.avatarId,
      image: users.image,
      requester: friendships.requesterId,
      addressee: friendships.addresseeId,
    })
    .from(friendships)
    .innerJoin(
      users,
      or(
        and(eq(friendships.requesterId, userId), eq(users.id, friendships.addresseeId)),
        and(eq(friendships.addresseeId, userId), eq(users.id, friendships.requesterId)),
      ),
    )
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    );

  if (allFriends.length === 0) return [];

  const friendIds = allFriends.map((f) => f.id);

  // Ya miembros (activos).
  const activeMembers = await db
    .select({ userId: groupMemberships.userId })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, groupId), isNull(groupMemberships.leftAt)));
  const memberSet = new Set(activeMembers.map((m) => m.userId));

  // Ya invitados (pending).
  const pendings = await db
    .select({ inviteeId: groupInvitations.inviteeId })
    .from(groupInvitations)
    .where(and(eq(groupInvitations.groupId, groupId), eq(groupInvitations.status, "pending")));
  const pendingSet = new Set(pendings.map((p) => p.inviteeId));

  return allFriends
    .filter((f) => !memberSet.has(f.id) && !pendingSet.has(f.id))
    .map((f) => ({
      id: f.id,
      name: f.name,
      username: f.username,
      avatarId: f.avatarId,
      image: f.image,
    }));
}
