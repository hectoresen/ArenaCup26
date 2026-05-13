import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { auth } from "@/lib/auth";
import { getInitialSnapshot } from "@/lib/leaderboard/mock";
import { setRequestLocale } from "next-intl/server";

/**
 * Ranking público dentro del área logada. Reusa el mismo
 * `LeaderboardView` que la landing pero sin su propio `<TopChrome>`
 * (el `<AppShell>` del route group `(app)` ya monta nav + avatar +
 * bell).
 *
 * El dataset hoy viene del mock; cuando aterrice `add-leaderboard-sse`
 * se cablea contra `userPoints` + SSE bus sin tocar este componente.
 */
export default async function RankingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [snapshot, session] = await Promise.all([getInitialSnapshot(), auth()]);
  return (
    <section className="-mx-5 -mt-5 flex justify-center px-5 pt-5">
      <LeaderboardView snapshot={snapshot} user={session?.user ?? null} withChrome={false} />
    </section>
  );
}
