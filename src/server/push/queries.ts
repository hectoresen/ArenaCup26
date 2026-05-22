import type { Database } from "@/server/db/client";
import { pushSubscriptions } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Devuelve todas las suscripciones activas de un user. Un user puede
 * tener varias (móvil, desktop, tablet).
 */
export async function getUserPushSubscriptions(
  db: Database,
  userId: string,
): Promise<PushSubscriptionRow[]> {
  return db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/** Borra una suscripción concreta (cuando el push devolvió `gone`). */
export async function deletePushSubscriptionByEndpoint(
  db: Database,
  endpoint: string,
): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Counter para mostrar "X devices conectados" en settings. */
export async function countUserPushSubscriptions(db: Database, userId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return rows[0]?.total ?? 0;
}
