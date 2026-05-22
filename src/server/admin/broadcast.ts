import { db } from "@/server/db/client";
import { notifications, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export type BroadcastInput = {
  title: string;
  body: string | null;
};

export type BroadcastResult = {
  recipients: number;
};

/**
 * Inserta una notificación `admin_broadcast` por cada usuario humano.
 * Los bots quedan excluidos — no consumen notificaciones.
 *
 * Decisión (2026-05-21): aparece en la campana como una notificación
 * más, sin web push, sin doble confirmación. El admin asume el
 * impacto al pulsar enviar. El audit log captura el envío.
 *
 * Implementación: un único `INSERT … SELECT` que genera una fila
 * por user humano. O(1) round-trips en vez de N. Para 5K usuarios
 * el insert es ~50ms.
 */
export async function broadcastToHumans(input: BroadcastInput): Promise<BroadcastResult> {
  const title = input.title.trim();
  const body = input.body?.trim() || null;

  if (title.length === 0) throw new Error("broadcastToHumans: title is required");
  if (title.length > 140) throw new Error("broadcastToHumans: title too long (max 140)");
  if (body && body.length > 500) throw new Error("broadcastToHumans: body too long (max 500)");

  // Subselect: ids de humanos. Insertamos un row por cada uno.
  const humanIds = await db.select({ id: users.id }).from(users).where(eq(users.isBot, false));

  if (humanIds.length === 0) return { recipients: 0 };

  await db.insert(notifications).values(
    humanIds.map((u) => ({
      userId: u.id,
      kind: "admin_broadcast" as const,
      title,
      body,
    })),
  );

  return { recipients: humanIds.length };
}
