import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { getInitialSnapshot } from "@/lib/leaderboard/mock";

export default async function HomePage() {
  const snapshot = await getInitialSnapshot();
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-9">
      <LeaderboardView snapshot={snapshot} />
    </main>
  );
}
