import type { Database } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { NotificationItem, NotificationKind, NotificationsView } from "./types";

const RECENT_LIMIT = 20;

/**
 * Devuelve las últimas N notificaciones del user + el unread count.
 * Una sola roundtrip — el unread se calcula con count(*) filter.
 */
export async function getNotificationsForUser(
  db: Database,
  userId: string,
): Promise<NotificationsView> {
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      matchId: notifications.matchId,
      achievementId: notifications.achievementId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(RECENT_LIMIT);

  const items: NotificationItem[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind as NotificationKind,
    title: r.title,
    body: r.body,
    matchId: r.matchId,
    achievementId: r.achievementId,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));

  const unreadCount = await getUnreadCount(db, userId);
  return { items, unreadCount };
}

/**
 * Conteo independiente — útil para el badge del bell cuando no
 * queremos cargar la lista entera (e.g. cada navegación).
 */
export async function getUnreadCount(db: Database, userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows[0]?.count ?? 0;
}

/**
 * Marca todas las notificaciones no leídas del user como leídas.
 * Idempotente.
 */
export async function markAllRead(db: Database, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
