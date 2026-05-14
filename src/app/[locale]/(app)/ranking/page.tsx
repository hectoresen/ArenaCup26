import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { auth } from "@/lib/auth";
import { getRealSnapshot } from "@/lib/leaderboard/real";
import { db } from "@/server/db/client";
import { setRequestLocale } from "next-intl/server";

/**
 * Ranking público dentro del área logada. Reusa el mismo
 * `LeaderboardView` que la landing pero sin su propio `<TopChrome>`
 * (el `<AppShell>` del route group `(app)` ya monta nav + avatar +
 * bell).
 *
 * Dataset real: query a `userPoints` mezclada con 3 placeholders fijos
 * para que el ranking no se vea vacío durante la fase de pruebas.
 * Cuando aterrice `add-leaderboard-sse` se reemplaza por suscripción
 * push sin cambiar el componente.
 */
export default async function RankingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [snapshot, session] = await Promise.all([getRealSnapshot(db), auth()]);
  return (
    <section className="-mx-5 -mt-5 flex justify-center px-5 pt-5">
      <LeaderboardView snapshot={snapshot} user={session?.user ?? null} withChrome={false} />
    </section>
  );
}
