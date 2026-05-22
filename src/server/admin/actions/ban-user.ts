"use server";

import { checkAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/server/admin/audit";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const BanSchema = z.object({
  userId: z.string().uuid(),
  /** ISO date string del fin del ban. `"permanent"` = año 9999. */
  until: z.union([z.string(), z.literal("permanent")]),
  reason: z.string().trim().max(500).nullable(),
});

export type BanResult = { ok: true } | { ok: false; error: string };

export async function banUserAction(input: unknown): Promise<BanResult> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const parsed = BanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid-input" };
  }

  // Protección contra auto-ban: el admin no puede banearse a sí mismo
  // (haría imposible deshacer la acción desde el panel).
  if (parsed.data.userId === check.user.id) {
    return { ok: false, error: "no-self-ban" };
  }

  const until =
    parsed.data.until === "permanent"
      ? new Date("9999-12-31T23:59:59Z")
      : new Date(parsed.data.until);

  if (Number.isNaN(until.getTime())) {
    return { ok: false, error: "invalid-until" };
  }

  await db.update(users).set({ bannedUntil: until }).where(eq(users.id, parsed.data.userId));

  await logAdminAction({
    adminUserId: check.user.id,
    action: "user_banned",
    targetType: "user",
    targetId: parsed.data.userId,
    payload: {
      until: until.toISOString(),
      permanent: parsed.data.until === "permanent",
      reason: parsed.data.reason,
    },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}

export async function unbanUserAction(input: unknown): Promise<BanResult> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const schema = z.object({ userId: z.string().uuid() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  await db.update(users).set({ bannedUntil: null }).where(eq(users.id, parsed.data.userId));

  await logAdminAction({
    adminUserId: check.user.id,
    action: "user_unbanned",
    targetType: "user",
    targetId: parsed.data.userId,
    payload: null,
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}
