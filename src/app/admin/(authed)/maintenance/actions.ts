"use server";

import { checkAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/server/admin/audit";
import { setMaintenanceMode } from "@/server/admin/settings";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ToggleSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().max(280).nullable(),
});

export type ToggleResult = { ok: true } | { ok: false; error: string };

/**
 * Toggle maintenance mode. Doble llave checada igual que el layout:
 * sin sesión admin, error. Tras el upsert, registra acción en audit
 * y revalida la página para reflejar el cambio inmediatamente.
 */
export async function toggleMaintenance(input: unknown): Promise<ToggleResult> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const parsed = ToggleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid-input" };
  }

  const message = parsed.data.message?.length ? parsed.data.message : null;

  await setMaintenanceMode({
    enabled: parsed.data.enabled,
    message,
    updatedBy: check.user.id,
  });

  await logAdminAction({
    adminUserId: check.user.id,
    action: "maintenance_toggle",
    payload: { enabled: parsed.data.enabled, message },
  });

  // Banner global se renderiza en root layout — revalidar todo es
  // la forma más simple de que el siguiente request lo vea.
  revalidatePath("/", "layout");
  return { ok: true };
}
