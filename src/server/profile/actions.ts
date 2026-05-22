"use server";

import { auth } from "@/lib/auth";
import { dlog } from "@/lib/debug-log";
import { assertNotInMaintenance } from "@/server/admin/maintenance-guard";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AVATAR_GALLERY } from "./avatars";

/**
 * Ventana mínima entre cambios de un mismo campo del perfil
 * (nombre, avatar). 1h desde 2026-05-18 (antes 48h, demasiado
 * restrictivo para la fase actual). Si abusan, subimos.
 */
const COOLDOWN_MS = 60 * 60 * 1000;

const nameSchema = z.string().trim().min(1).max(60);

/** IDs válidos del avatar gallery + `null` (volver al de Google). */
const avatarSchema = z
  .string()
  .nullable()
  .refine((v) => v === null || AVATAR_GALLERY.some((a) => a.id === v), "Avatar id no reconocido");

export type ProfileActionResult =
  | { ok: true }
  | {
      ok: false;
      code: "unauthorized" | "invalid_input" | "cooldown";
      /** Si `cooldown`, ms restantes hasta que se pueda volver a cambiar. */
      remainingMs?: number;
    };

/**
 * Actualiza el `name` del user logado. Aplica cooldown de 1h:
 *  - Si el user no ha cambiado nunca (`name_changed_at IS NULL`),
 *    pasa.
 *  - Si el último cambio fue hace ≥ 1h, pasa.
 *  - Si fue hace menos, devuelve `code: "cooldown"` con el tiempo
 *    restante para que el cliente lo muestre.
 */
export async function updateProfileName(rawName: string): Promise<ProfileActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  await assertNotInMaintenance();

  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) {
    dlog("ranking", "updateProfileName invalid_input", parsed.error.flatten());
    return { ok: false, code: "invalid_input" };
  }
  const name = parsed.data;

  const row = await db
    .select({
      name: users.name,
      nameChangedAt: users.nameChangedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const last = row[0]?.nameChangedAt ?? null;
  if (last) {
    const elapsed = Date.now() - last.getTime();
    if (elapsed < COOLDOWN_MS) {
      return {
        ok: false,
        code: "cooldown",
        remainingMs: COOLDOWN_MS - elapsed,
      };
    }
  }

  // No-op si el valor coincide con el actual (no consumir el cooldown
  // por un click accidental).
  if (row[0]?.name === name) return { ok: true };

  await db
    .update(users)
    .set({ name, nameChangedAt: new Date() })
    .where(eq(users.id, session.user.id));

  dlog("ranking", "profile name updated", { userId: session.user.id });

  revalidatePath("/inicio");
  if (session.user.username) revalidatePath(`/u/${session.user.username}`);
  return { ok: true };
}

/**
 * Cambia el `avatar_id` del user. `null` significa "volver al avatar
 * de Google" (renderizamos `user.image` cuando avatar_id es null).
 * Mismo cooldown 1h que el nombre.
 */
export async function updateProfileAvatar(
  rawAvatarId: string | null,
): Promise<ProfileActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  await assertNotInMaintenance();

  const parsed = avatarSchema.safeParse(rawAvatarId);
  if (!parsed.success) {
    dlog("ranking", "updateProfileAvatar invalid_input", parsed.error.flatten());
    return { ok: false, code: "invalid_input" };
  }

  const row = await db
    .select({
      avatarId: users.avatarId,
      avatarChangedAt: users.avatarChangedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const last = row[0]?.avatarChangedAt ?? null;
  if (last) {
    const elapsed = Date.now() - last.getTime();
    if (elapsed < COOLDOWN_MS) {
      return {
        ok: false,
        code: "cooldown",
        remainingMs: COOLDOWN_MS - elapsed,
      };
    }
  }

  if (row[0]?.avatarId === parsed.data) return { ok: true };

  await db
    .update(users)
    .set({ avatarId: parsed.data, avatarChangedAt: new Date() })
    .where(eq(users.id, session.user.id));

  dlog("ranking", "profile avatar updated", {
    userId: session.user.id,
    avatarId: parsed.data,
  });

  revalidatePath("/inicio");
  if (session.user.username) revalidatePath(`/u/${session.user.username}`);
  return { ok: true };
}
