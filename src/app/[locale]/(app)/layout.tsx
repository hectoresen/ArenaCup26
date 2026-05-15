import { AppShell } from "@/components/app-shell/app-shell";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { getNotificationsForUser } from "@/server/notifications/queries";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { markAllReadAction } from "./_actions";

/**
 * Layout del route group `(app)`. Envuelve todas las rutas privadas:
 * `/inicio`, `/partidos`, `/ranking`, `/logros`, `/u/<username>`, etc.
 *
 * Aplica un guard server-side: si no hay sesión, redirige a la
 * landing pública. La landing renderiza el JoinCTA que dispara el
 * flow de login Google.
 */
export default async function AppGroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    // El redirect respeta el locale activo (es → `/es`, en → `/en`, ...).
    redirect(`/${locale}`);
  }

  // Onboarding guard: si el user no ha completado el wizard (`onboarded_at
  // IS NULL`) Y la ruta actual NO es `/bienvenido`, redirigir. Sin esto,
  // el user nuevo aterriza en `/inicio` con username auto-generado y país
  // vacío. Excluimos la propia ruta del wizard para no entrar en loop.
  const h = await headers();
  const currentPath = h.get("x-nextjs-pathname") ?? h.get("x-pathname") ?? "";
  const onboardingRow = await db
    .select({ onboardedAt: users.onboardedAt })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const isOnboarded = Boolean(onboardingRow[0]?.onboardedAt);
  if (!isOnboarded && !currentPath.endsWith("/bienvenido")) {
    redirect(`/${locale}/bienvenido`);
  }

  const { items, unreadCount } = await getNotificationsForUser(db, session.user.id);

  return (
    <AppShell
      user={session.user}
      notifications={items}
      unreadCount={unreadCount}
      onMarkAllRead={markAllReadAction}
    >
      {children}
    </AppShell>
  );
}
