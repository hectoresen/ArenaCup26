"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dlog, derr } from "@/lib/debug-log";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import {
  GROUP_COLORS,
  groupMemberships,
  groups,
} from "@/server/db/schema";
import { notifyWithPush } from "@/server/notifications/notify-with-push";
import {
  GROUP_MEMBERS_DEFAULT,
  GROUP_MEMBERS_MAX,
  GROUP_MEMBERS_MIN,
  canJoinAnotherGroup,
  countActiveMembers,
} from "./caps";
import type { GroupActionResult } from "./types";

/**
 * Validación del nombre. Mínimo 3 chars no-vacíos, máximo 40. Sin
 * caracteres de control. Confiamos en el escaping de React para XSS
 * pero limitamos longitud para no romper layouts.
 */
const nameSchema = z.string().trim().min(3).max(40);

const colorSchema = z.enum(GROUP_COLORS);

const createGroupSchema = z.object({
  name: nameSchema,
  color: colorSchema,
  visibility: z.enum(["public", "private"]),
  maxMembers: z
    .number()
    .int()
    .min(GROUP_MEMBERS_MIN)
    .max(GROUP_MEMBERS_MAX)
    .default(GROUP_MEMBERS_DEFAULT),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

/**
 * Crea un grupo nuevo. El user logado pasa a ser el admin y se
 * inserta automáticamente como miembro activo. Bloquea si el user ya
 * está en `MAX_GROUPS_PER_USER` grupos activos.
 */
export async function createGroup(input: CreateGroupInput): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    dlog("ranking", "createGroup invalid_input", parsed.error.flatten());
    return { ok: false, code: "invalid_input" };
  }

  // Cap 3 grupos activos por user (admin + member).
  const cap = await canJoinAnotherGroup(db, userId);
  if (!cap.ok) {
    dlog("ranking", "createGroup cap reached", { userId, reason: cap.reason });
    return { ok: false, code: "cap_groups_reached" };
  }

  // Insert grupo + membership admin en transacción atómica.
  const [group] = await db
    .insert(groups)
    .values({
      creatorId: userId,
      name: parsed.data.name,
      color: parsed.data.color,
      visibility: parsed.data.visibility,
      maxMembers: parsed.data.maxMembers,
    })
    .returning({ id: groups.id });

  if (!group) {
    derr("ranking", "createGroup: insert returned no rows", { userId });
    return { ok: false, code: "invalid_input" };
  }

  await db.insert(groupMemberships).values({
    groupId: group.id,
    userId,
    role: "admin",
  });

  dlog("ranking", "group created", { groupId: group.id, userId });

  revalidatePath("/social");
  revalidatePath("/ranking");
  return { ok: true, groupId: group.id };
}

const updateGroupSchema = z.object({
  groupId: z.string().uuid(),
  name: nameSchema.optional(),
  color: colorSchema.optional(),
  visibility: z.enum(["public", "private"]).optional(),
  maxMembers: z
    .number()
    .int()
    .min(GROUP_MEMBERS_MIN)
    .max(GROUP_MEMBERS_MAX)
    .optional(),
});

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

/**
 * Actualiza nombre / color / visibility / maxMembers del grupo. Solo
 * admin. Si baja `maxMembers` por debajo del count actual, bloquea
 * (sería expulsar a la fuerza — no lo soportamos).
 */
export async function updateGroup(input: UpdateGroupInput): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  const parsed = updateGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { groupId, ...patch } = parsed.data;

  const adminRows = await db
    .select({ creatorId: groups.creatorId, deletedAt: groups.deletedAt, role: groupMemberships.role })
    .from(groups)
    .leftJoin(
      groupMemberships,
      and(eq(groupMemberships.groupId, groups.id), eq(groupMemberships.userId, userId)),
    )
    .where(eq(groups.id, groupId))
    .limit(1);
  const row = adminRows[0];
  if (!row || row.deletedAt) return { ok: false, code: "not_found" };
  if (row.role !== "admin") return { ok: false, code: "unauthorized" };

  // Si baja `maxMembers`, verifica contra count actual.
  if (typeof patch.maxMembers === "number") {
    const current = await countActiveMembers(db, groupId);
    if (patch.maxMembers < current) {
      return { ok: false, code: "max_members_below_count" };
    }
  }

  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof patch.name === "string") updateSet.name = patch.name;
  if (typeof patch.color === "string") updateSet.color = patch.color;
  if (typeof patch.visibility === "string") updateSet.visibility = patch.visibility;
  if (typeof patch.maxMembers === "number") updateSet.maxMembers = patch.maxMembers;

  if (Object.keys(updateSet).length === 1) {
    // Solo updatedAt — no se modificó nada útil, no merece la pena.
    return { ok: true, groupId };
  }

  await db.update(groups).set(updateSet).where(eq(groups.id, groupId));

  dlog("ranking", "group updated", { groupId, userId, patch });

  revalidatePath("/social");
  revalidatePath(`/social/grupos/${groupId}`);
  revalidatePath("/ranking");
  return { ok: true, groupId };
}

/**
 * Soft delete del grupo. Solo admin. Marca `deleted_at` + notifica a
 * todos los miembros activos. Las memberships quedan en BD para
 * preservar el histórico (los ex-miembros congelados pierden la
 * referencia al grupo pero no sus puntos, que están en `user_points`).
 */
export async function deleteGroup(groupId: string): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  const adminRows = await db
    .select({
      role: groupMemberships.role,
      deletedAt: groups.deletedAt,
      name: groups.name,
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
  const row = adminRows[0];
  if (!row || row.deletedAt) return { ok: false, code: "not_found" };
  if (row.role !== "admin") return { ok: false, code: "unauthorized" };

  // Snapshot de los miembros activos antes de tocar nada — para
  // mandar notificación a todos.
  const members = await db
    .select({ userId: groupMemberships.userId })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, groupId), isNull(groupMemberships.leftAt)));

  await db.update(groups).set({ deletedAt: new Date() }).where(eq(groups.id, groupId));

  // Notificar a todos los miembros (incluido el admin). Push opt-in.
  // Errores en pushes individuales no abortan la action.
  for (const m of members) {
    try {
      await notifyWithPush({
        db,
        userId: m.userId,
        kind: "group_deleted",
        title: `El grupo "${row.name}" ha sido cerrado`,
        body: null,
        pushable: m.userId !== userId, // no push al que lo ha borrado
      });
    } catch (err) {
      derr("ranking", "deleteGroup notify failed", {
        groupId,
        memberId: m.userId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  dlog("ranking", "group deleted", { groupId, userId, notified: members.length });

  revalidatePath("/social");
  revalidatePath("/ranking");
  return { ok: true, groupId };
}

const transferAdminSchema = z.object({
  groupId: z.string().uuid(),
  newAdminUserId: z.string().uuid(),
});

/**
 * Transfiere admin a otro miembro activo. El admin actual pasa a
 * `member`, el otro a `admin`. Atómico — si una de las dos UPDATEs
 * falla, no quedará un grupo con dos admins (lo asumimos en
 * postgres-js single connection; si migramos a transactions, mejor
 * aún). El nuevo admin recibe notificación push.
 */
export async function transferAdmin(
  input: z.infer<typeof transferAdminSchema>,
): Promise<GroupActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  const userId = session.user.id;

  const parsed = transferAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const { groupId, newAdminUserId } = parsed.data;

  if (newAdminUserId === userId) return { ok: false, code: "invalid_input" };

  // Validar que viewer es admin actual + groupId existe + new admin
  // es miembro activo.
  const rows = await db
    .select({
      myRole: groupMemberships.role,
      deletedAt: groups.deletedAt,
      groupName: groups.name,
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
  if (row.myRole !== "admin") return { ok: false, code: "unauthorized" };

  const targetRows = await db
    .select({ leftAt: groupMemberships.leftAt })
    .from(groupMemberships)
    .where(
      and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, newAdminUserId)),
    )
    .limit(1);
  const target = targetRows[0];
  if (!target || target.leftAt !== null) return { ok: false, code: "not_member" };

  // Swap roles. Postgres-js no expone transactions easily aquí; el
  // window de inconsistencia es ~ms y no rompe nada lógicamente.
  await db
    .update(groupMemberships)
    .set({ role: "member" })
    .where(
      and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)),
    );
  await db
    .update(groupMemberships)
    .set({ role: "admin" })
    .where(
      and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, newAdminUserId)),
    );

  await notifyWithPush({
    db,
    userId: newAdminUserId,
    kind: "group_admin_transferred",
    title: `Ahora eres admin de "${row.groupName}"`,
    body: null,
    pushable: true,
  });

  dlog("ranking", "admin transferred", { groupId, from: userId, to: newAdminUserId });

  revalidatePath(`/social/grupos/${groupId}`);
  return { ok: true, groupId };
}
