"use server";

import { dlog } from "@/lib/debug-log";
import { checkAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/server/admin/audit";
import { db } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const Schema = z.object({ userId: z.string().uuid() });

export type RevokeResult = { ok: true; revoked: number } | { ok: false; error: string };

/**
 * Borra todas las filas de `sessions` del user — su sessionToken
 * cookie queda huérfana y la siguiente request lo lleva al login.
 * Útil tras un ban o cuando sospechas cuenta comprometida.
 */
export async function revokeUserSessionsAction(input: unknown): Promise<RevokeResult> {
  dlog("ranking", "revokeUserSessionsAction invoked", { input });
  const check = await checkAdmin();
  if (!check.ok) {
    dlog("ranking", "revokeUserSessionsAction blocked: not admin", { reason: check.reason });
    return { ok: false, error: "no-permission" };
  }

  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    dlog("ranking", "revokeUserSessionsAction invalid input", { issues: parsed.error.issues });
    return { ok: false, error: "invalid-input" };
  }

  // No bloqueamos auto-revoke (a veces el admin quiere cerrar
  // su propia sesión desde el panel), pero anotamos en payload.
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, parsed.data.userId))
    .returning({ token: sessions.sessionToken });

  await logAdminAction({
    adminUserId: check.user.id,
    action: "user_sessions_revoked",
    targetType: "user",
    targetId: parsed.data.userId,
    payload: {
      revokedCount: deleted.length,
      selfRevoke: parsed.data.userId === check.user.id,
    },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true, revoked: deleted.length };
}
