import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { auth } from "@/lib/auth";
import { getInitialSnapshot } from "@/lib/leaderboard/mock";
import { setRequestLocale } from "next-intl/server";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [snapshot, session] = await Promise.all([getInitialSnapshot(), auth()]);
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-9">
      <LeaderboardView snapshot={snapshot} user={session?.user ?? null} />
    </main>
  );
}
