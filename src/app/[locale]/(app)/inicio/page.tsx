import { DashboardSections } from "@/components/dashboard/dashboard-sections";
import { Floaters } from "@/components/dashboard/floaters";
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
 */
export default async function InicioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const data = await getDashboardData(db, session.user.id);

  return (
    <>
      <Floaters />
      <DashboardSections data={data} />
    </>
  );
}
