"use server";

import { checkAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/server/admin/audit";
import { db } from "@/server/db/client";
import { notifications, pointEvents, userPoints } from "@/server/db/schema";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AdjustSchema = z.object({
  userId: z.string().uuid(),
  delta: z.number().int().min(-10000).max(10000),
  reason: z.string().trim().min(1).max(500),
});

export type AdjustResult = { ok: true } | { ok: false; error: string };

/**
 * Ajusta los puntos de un user manualmente. Insertamos un
 * `point_event` con kind `manual_adjustment` y delta (positivo o
 * negativo) — es la fuente de verdad. Después actualizamos el
 * cache `user_points.totalPoints` con un `+= delta` para no tener
 * que recalcular todo el snapshot.
 *
 * Si el user no tiene fila en `user_points` aún (raro pero posible
 * para users nuevos sin predicciones), el upsert la crea con el
 * delta como punto de partida.
 */
export async function adjustPointsAction(input: unknown): Promise<AdjustResult> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const parsed = AdjustSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid-input" };
  }

  if (parsed.data.delta === 0) {
    return { ok: false, error: "delta-zero" };
  }

  const sign = parsed.data.delta > 0 ? "+" : "";
  const title =
    parsed.data.delta > 0
      ? `Has recibido ${sign}${parsed.data.delta} puntos`
      : `Ajuste de ${parsed.data.delta} puntos`;

  await db.transaction(async (tx) => {
    await tx.insert(pointEvents).values({
      userId: parsed.data.userId,
      matchId: null,
      kind: "manual_adjustment",
      points: parsed.data.delta,
    });

    await tx
      .insert(userPoints)
      .values({
        userId: parsed.data.userId,
        totalPoints: parsed.data.delta,
      })
      .onConflictDoUpdate({
        target: userPoints.userId,
        set: {
          totalPoints: sql`${userPoints.totalPoints} + ${parsed.data.delta}`,
          updatedAt: sql`now()`,
        },
      });

    // Notificación in-app al user afectado con el motivo del admin.
    // Reusamos kind `admin_broadcast` (ya tiene label "Aviso" en la
    // campana) — un ajuste de puntos manual conceptualmente es un
    // aviso del equipo. Sin push: la campana del polling lo recoge
    // en < 60s sin requerir F5.
    await tx.insert(notifications).values({
      userId: parsed.data.userId,
      kind: "admin_broadcast",
      title,
      body: parsed.data.reason,
    });
  });

  await logAdminAction({
    adminUserId: check.user.id,
    action: "points_adjusted",
    targetType: "user",
    targetId: parsed.data.userId,
    payload: {
      delta: parsed.data.delta,
      reason: parsed.data.reason,
    },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}
