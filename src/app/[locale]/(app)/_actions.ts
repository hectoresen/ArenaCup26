"use server";

import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { markAllRead } from "@/server/notifications/queries";
import { revalidatePath } from "next/cache";

/**
 * Marca todas las notificaciones del usuario como leídas.
 * El bell la invoca al abrirse — UX agresiva pero clara.
 */
export async function markAllReadAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await markAllRead(db, session.user.id);
  // Las rutas privadas dependen del unreadCount → revalidamos el layout.
  revalidatePath("/", "layout");
}
