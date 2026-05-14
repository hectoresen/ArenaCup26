import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { auth } from "@/lib/auth";
import { getRealSnapshot } from "@/lib/leaderboard/real";
import { db } from "@/server/db/client";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

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
    <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-9">
      <LeaderboardView snapshot={snapshot} user={null} />
    </main>
  );
}
