"use server";

import { eq, sql } from "drizzle-orm";
import { dlog } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { pushSubscriptions } from "@/server/db/schema";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type SubscribeResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "not_configured" | "invalid_input" };

/**
 * Persiste una suscripción push del browser actual. Si el mismo
 * endpoint ya existe (re-suscripción tras refresh permission, p.ej.),
 * actualizamos sus keys + last_used_at. Un usuario puede tener N
 * filas (una por device/browser).
 */
export async function subscribePush(input: PushSubscriptionInput): Promise<SubscribeResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return { ok: false, code: "not_configured" };
  }
  if (
    !input.endpoint ||
    !input.keys?.p256dh ||
    !input.keys?.auth ||
    !input.endpoint.startsWith("https://")
  ) {
    return { ok: false, code: "invalid_input" };
  }

  await db
    .insert(pushSubscriptions)
    .values({
      userId: session.user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: session.user.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        lastUsedAt: sql`now()`,
      },
    });

  dlog("push", "subscription saved", { userId: session.user.id });
  return { ok: true };
}

export type UnsubscribeResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "not_found" };

/**
 * Borra una suscripción concreta del user actual. Acepta el endpoint
 * que el browser devuelve al hacer `.unsubscribe()`. Si el endpoint
 * no pertenece al user logado, devolvemos `not_found` para no filtrar
 * info de otras cuentas.
 */
export async function unsubscribePush(endpoint: string): Promise<UnsubscribeResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };

  const rows = await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .returning({ userId: pushSubscriptions.userId });
  const row = rows[0];
  if (!row || row.userId !== session.user.id) {
    return { ok: false, code: "not_found" };
  }
  return { ok: true };
}
