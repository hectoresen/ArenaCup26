"use server";

import { checkAdmin } from "@/lib/admin-auth";
import { dlog } from "@/lib/debug-log";
import { logAdminAction } from "@/server/admin/audit";
import { db } from "@/server/db/client";
import { achievementDefinitions, notifications, userAchievements } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const Schema = z.object({
  userId: z.string().uuid(),
  achievementId: z.string().min(1).max(100),
});

export type AchievementActionResult = { ok: true } | { ok: false; error: string };

/**
 * Otorga un logro manualmente a un usuario. Idempotente: si ya lo
 * tenía, devuelve `ok: true` sin tocar nada.
 *
 * Inserta también una notificación "Aviso" en la campana del user
 * con el título del logro, para que sepa que se lo han concedido.
 */
export async function grantAchievementAction(input: unknown): Promise<AchievementActionResult> {
  dlog("ranking", "grantAchievementAction invoked", { input });
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const def = await db
    .select({ id: achievementDefinitions.id, title: achievementDefinitions.title })
    .from(achievementDefinitions)
    .where(eq(achievementDefinitions.id, parsed.data.achievementId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!def) return { ok: false, error: "achievement-not-found" };

  const existing = await db
    .select({ id: userAchievements.achievementId })
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.userId, parsed.data.userId),
        eq(userAchievements.achievementId, parsed.data.achievementId),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing) return { ok: true }; // ya lo tenía

  await db.transaction(async (tx) => {
    await tx.insert(userAchievements).values({
      userId: parsed.data.userId,
      achievementId: parsed.data.achievementId,
    });
    await tx.insert(notifications).values({
      userId: parsed.data.userId,
      kind: "achievement_unlocked",
      title: def.title,
      body: "El equipo te ha otorgado este logro.",
      achievementId: def.id,
    });
  });

  await logAdminAction({
    adminUserId: check.user.id,
    action: "achievement_granted",
    targetType: "user",
    targetId: parsed.data.userId,
    payload: { achievementId: def.id, achievementTitle: def.title },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}

/**
 * Retira un logro previamente desbloqueado. NO notifica al user
 * (sería raro un "te quitamos el logro" — si hay confusión, el
 * admin puede enviar notificación manual aparte).
 *
 * NO borra las notificaciones `achievement_unlocked` históricas
 * que el user pueda tener en su campana (decisión: el historial
 * de la campana es immutable; el "unlock-revoke" deja una traza
 * inevitable de que en algún momento se desbloqueó).
 */
export async function revokeAchievementAction(input: unknown): Promise<AchievementActionResult> {
  dlog("ranking", "revokeAchievementAction invoked", { input });
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const deleted = await db
    .delete(userAchievements)
    .where(
      and(
        eq(userAchievements.userId, parsed.data.userId),
        eq(userAchievements.achievementId, parsed.data.achievementId),
      ),
    )
    .returning({ id: userAchievements.achievementId });

  if (deleted.length === 0) {
    return { ok: false, error: "not-unlocked" };
  }

  await logAdminAction({
    adminUserId: check.user.id,
    action: "achievement_revoked",
    targetType: "user",
    targetId: parsed.data.userId,
    payload: { achievementId: parsed.data.achievementId },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}
