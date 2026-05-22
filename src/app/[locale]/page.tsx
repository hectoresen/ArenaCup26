import { ThrottledState } from "@/components/common/throttled-state";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { auth } from "@/lib/auth";
import { getRealSnapshot } from "@/lib/leaderboard/real";
import { checkPublicReadLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { db } from "@/server/db/client";
import { setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Rate limit por IP. Antes que cualquier I/O caro (query a BD,
  // resolución de sesión) para que un scraper no nos cueste recursos
  // antes de ser bloqueado. 60 req/60s permite ráfagas humanas
  // normales (recarga + click + recarga rápida) sin penalizar.
  const ip = getRequestIp(await headers());
  const rl = await checkPublicReadLimit(ip);
  if (!rl.ok) {
    return <ThrottledState />;
  }

  // Si el visitante ya está autenticado, la landing pública no le
  // aporta nada — lo llevamos directo al panel. Cubre cualquier flujo
  // de sign-in (modal, /api/auth/signin directo, vuelta de Google con
  // callbackUrl default).
  const session = await auth();
  if (session?.user) {
    redirect(`/${locale}/inicio`);
  }

  const snapshot = await getRealSnapshot(db);
  return (
    <main
      id="main-content"
      className="relative z-10 flex min-h-screen items-center justify-center px-5 py-9"
    >
      <LeaderboardView snapshot={snapshot} user={null} />
    </main>
  );
}
