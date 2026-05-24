"use server";

import { checkAdmin } from "@/lib/admin-auth";
import { dlog } from "@/lib/debug-log";
import { logAdminAction } from "@/server/admin/audit";
import { db } from "@/server/db/client";
import { notifications, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const NotifySchema = z.object({
  userId: z.string().uuid(),
  title: z.string().trim().min(1, "title-required").max(140, "title-too-long"),
  body: z.string().trim().max(500, "body-too-long").nullable(),
});

export type NotifyUserResult = { ok: true } | { ok: false; error: string };

/**
 * Envía una notificación in-app a un usuario específico (no
 * broadcast). Misma plumbing que el broadcast — kind
 * `admin_broadcast` (etiqueta "Aviso" en la campana) — pero
 * solo inserta una fila para el `userId` recibido.
 *
 * Validación: el user debe existir y NO ser bot (no inyectamos
 * notificaciones a perfiles sintéticos del ranking).
 */
export async function sendUserNotificationAction(input: unknown): Promise<NotifyUserResult> {
  dlog("ranking", "sendUserNotificationAction invoked", { input });
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const parsed = NotifySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid-input" };
  }

  const target = await db
    .select({ id: users.id, isBot: users.isBot })
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!target) return { ok: false, error: "user-not-found" };
  if (target.isBot) return { ok: false, error: "cannot-notify-bot" };

  const body = parsed.data.body?.length ? parsed.data.body : null;

  await db.insert(notifications).values({
    userId: parsed.data.userId,
    kind: "admin_broadcast",
    title: parsed.data.title,
    body,
  });

  await logAdminAction({
    adminUserId: check.user.id,
    action: "user_notification_sent",
    targetType: "user",
    targetId: parsed.data.userId,
    payload: { title: parsed.data.title, body },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}
