"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dlog } from "@/lib/debug-log";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import type { UserPrivacy } from "./apply";

const privacySchema = z.object({
  visibility: z.enum(["public", "friends_only", "private"]),
  showHistory: z.boolean(),
});

export type UpdatePrivacyResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "invalid_input" };

/**
 * Server action que actualiza las preferencias de privacidad del
 * user autenticado. Valida con zod, persiste el JSONB y revalida
 * las páginas que dependen del shape del usuario.
 */
export async function updatePrivacy(input: UserPrivacy): Promise<UpdatePrivacyResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, code: "unauthorized" };
  }

  const parsed = privacySchema.safeParse(input);
  if (!parsed.success) {
    dlog("ranking", "updatePrivacy invalid_input", parsed.error.flatten());
    return { ok: false, code: "invalid_input" };
  }

  await db.update(users).set({ privacy: parsed.data }).where(eq(users.id, session.user.id));

  dlog("ranking", "privacy updated", {
    userId: session.user.id,
    privacy: parsed.data,
  });

  // Revalidar páginas que dependen del shape del user.
  revalidatePath("/ajustes/privacidad");
  if (session.user.username) {
    revalidatePath(`/u/${session.user.username}`);
  }
  revalidatePath("/ranking");
  revalidatePath("/");

  return { ok: true };
}

