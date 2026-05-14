import type { Database } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import type { NotificationKind } from "./types";

export type CreateNotificationInput = {
  db: Database;
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  matchId?: string | null;
  achievementId?: string | null;
};

/**
 * Inserta una notificación nueva. Los módulos llamadores
 * (predicciones, scoring, achievements) usan esto cuando ocurre el
 * evento correspondiente.
 *
 * Idempotencia: NO se aplica a este nivel. Si el caller quiere
 * evitar duplicados (e.g. una sola noti "prediction_sent" por match)
 * debe verificar antes. Por defecto cada llamada inserta una fila
 * nueva.
 */
export async function createNotification(input: CreateNotificationInput): Promise<{ id: string }> {
  const rows = await input.db
    .insert(notifications)
    .values({
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      matchId: input.matchId ?? null,
      achievementId: input.achievementId ?? null,
    })
    .returning({ id: notifications.id });
  const row = rows[0];
  if (!row) throw new Error("createNotification: insert returned no rows");
  return { id: row.id };
}
