import { AppShell } from "@/components/app-shell/app-shell";
import { auth } from "@/lib/auth";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

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
  if (!session?.user) {
    // El redirect respeta el locale activo (es → `/es`, en → `/en`, ...).
    redirect(`/${locale}`);
  }

  return <AppShell user={session.user}>{children}</AppShell>;
}
