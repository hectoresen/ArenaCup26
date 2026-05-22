"use server";

import { auth } from "@/lib/auth";
import { dlog } from "@/lib/debug-log";
import { db } from "@/server/db/client";
import { usernameHistory, users } from "@/server/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Reglas de username: 3-20 chars, lowercase, alfanumérico + guion.
 * Coincide con la regex que el slugify produce, así un user que
 * cambia su username manualmente nunca queda en un estado inválido
 * respecto al auto-gen.
 */
const usernameRegex = /^[a-z0-9](?:[a-z0-9-]{1,18}[a-z0-9])?$/;

/**
 * País ISO 3166-1 alpha-2 en mayúsculas (e.g. "ES", "MX"). El campo
 * en BD es varchar(3) por convención FIFA, pero solo aceptamos 2-3
 * letras mayúsculas.
 */
const countrySchema = z
  .string()
  .trim()
  .min(2)
  .max(3)
  .regex(/^[A-Z]{2,3}$/, "Country must be a 2-3 letter ISO code");

/**
 * Schema del wizard. NO incluye `name` — el nombre real viene de
 * Google y se conserva tal cual (el user puede cambiarlo después en
 * ajustes si quiere). El wizard solo confirma username (que ya
 * tiene un valor auto-generado editable) y país.
 */
const completeSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(usernameRegex, "username must be 3-20 chars, a-z/0-9/-"),
  country: countrySchema,
});

export type CompleteOnboardingResult =
  | { ok: true }
  | {
      ok: false;
      code: "unauthorized" | "invalid_input" | "username_taken";
      detail?: string;
    };

/**
 * Completa el wizard de bienvenida.
 *
 *  - Valida name/username/country con zod.
 *  - Si el username cambió respecto al actual del user, comprueba
 *    unicidad y registra el viejo en `username_history` para que
 *    URLs antiguas de `/u/<old>` puedan redirigir (futura
 *    capability).
 *  - Setea `onboarded_at = now()` (idempotente: re-llamar no resetea
 *    el wizard, pero sí permite actualizar nombre/país/username).
 *  - Revalida `/inicio`, `/u/<username>` y el path antiguo si cambió.
 */
export async function completeOnboarding(
  input: z.input<typeof completeSchema>,
): Promise<CompleteOnboardingResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, code: "unauthorized" };
  }

  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) {
    dlog("ranking", "onboarding invalid_input", parsed.error.flatten().fieldErrors);
    return {
      ok: false,
      code: "invalid_input",
      detail: JSON.stringify(parsed.error.flatten().fieldErrors),
    };
  }
  const data = parsed.data;

  // Cargar el username actual para decidir si hay cambio.
  const current = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const previousUsername = current[0]?.username ?? null;

  // Si cambia el username, verificar unicidad excluyendo al propio user.
  if (data.username !== previousUsername) {
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, data.username), ne(users.id, session.user.id)))
      .limit(1);
    if (taken.length > 0) {
      dlog("ranking", "onboarding username_taken", { username: data.username });
      return { ok: false, code: "username_taken" };
    }
  }

  await db
    .update(users)
    .set({
      username: data.username,
      country: data.country,
      onboardedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  if (previousUsername && previousUsername !== data.username) {
    // Registrar el username anterior para que URLs viejas de
    // /u/<previousUsername> sigan resolvibles cuando aterrice la
    // capability de redirects (`add-username-history-redirects`).
    await db
      .insert(usernameHistory)
      .values({
        userId: session.user.id,
        oldUsername: previousUsername,
      })
      .onConflictDoNothing();
    revalidatePath(`/u/${previousUsername}`);
  }

  revalidatePath("/inicio");
  revalidatePath(`/u/${data.username}`);

  dlog("ranking", "onboarding completed", {
    userId: session.user.id,
    usernameChanged: previousUsername !== data.username,
  });

  return { ok: true };
}
