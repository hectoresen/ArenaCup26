import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getNotificationsForUser } from "@/server/notifications/queries";
import { NextResponse } from "next/server";

/**
 * Endpoint de polling para la campana del cliente. Devuelve las
 * notificaciones más recientes + el unread count. Lo llama el
 * `NotificationBell` cada 60s para detectar broadcasts u otros
 * eventos sin requerir que el user haga F5.
 *
 * Cabecera `Cache-Control: no-store` porque siempre queremos
 * estado fresco. Sin sesión devuelve `204` (no content) para no
 * exponer ningún dato.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new NextResponse(null, { status: 204 });
  }

  const view = await getNotificationsForUser(db, userId);
  return NextResponse.json(view, {
    headers: { "Cache-Control": "no-store" },
  });
}
