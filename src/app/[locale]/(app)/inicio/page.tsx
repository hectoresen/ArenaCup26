import { DashboardSections } from "@/components/dashboard/dashboard-sections";
import { Floaters } from "@/components/dashboard/floaters";
import type { MiniTab } from "@/components/dashboard/mini-leaderboard";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/server/dashboard/queries";
import { db } from "@/server/db/client";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Panel del usuario. SSR puro con `getDashboardData(userId)` que
 * paraleliza todas las queries (`Promise.all` interno) y entrega el
 * `DashboardData` listo para los componentes.
 *
 * El guard de sesión vive en `(app)/layout.tsx`; aquí se asume que
 * `auth()` devuelve un user válido. Como salvaguarda extra hacemos un
 * `redirect(...)` defensivo: si `auth()` falla por cualquier motivo,
 * caemos a `/`.
 *
 * `?mini=amigos` toggle del mini-leaderboard al subset de amigos
 * (la tab solo se renderiza si el user tiene ≥1 amigo).
 */
export default async function InicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mini?: string }>;
}) {
  const { locale } = await params;
  const { mini } = await searchParams;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const data = await getDashboardData(db, session.user.id);
  const miniTab: MiniTab = mini === "amigos" ? "amigos" : "global";

  return (
    <>
      <Floaters />
      <DashboardSections data={data} miniTab={miniTab} />
    </>
  );
}
