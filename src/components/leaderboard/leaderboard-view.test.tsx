import type { LeaderboardSnapshot, Player } from "@/lib/leaderboard/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { LeaderboardView } from "./leaderboard-view";

function mkPlayer(rank: number): Player {
  return {
    id: `u${rank}`,
    username: `user${rank}`,
    name: `User ${rank}`,
    countryCode: "ES",
    countryName: "España",
    flag: "🇪🇸",
    points: 1000 - rank,
    streak: 0,
    correctCount: 0,
    rank,
    previousRank: rank,
    isOnline: false,
    avatarId: null,
    image: null,
  };
}

function snapshotOf(n: number): LeaderboardSnapshot {
  return {
    generatedAt: "2026-06-17T08:00:00.000Z",
    players: Array.from({ length: n }, (_, i) => mkPlayer(i + 1)),
  };
}

describe("<LeaderboardView> league dividers", () => {
  it("inserts the gold divider after rank 10 when the list reaches that depth", () => {
    renderWithProviders(
      <LeaderboardView snapshot={snapshotOf(15)} user={null} withChrome={false} />,
    );
    expect(screen.getByTestId("league-divider-gold")).toBeInTheDocument();
    expect(screen.queryByTestId("league-divider-silver")).not.toBeInTheDocument();
    expect(screen.queryByTestId("league-divider-bronze")).not.toBeInTheDocument();
  });

  it("inserts gold + silver dividers with 25 players (no bronze yet)", () => {
    renderWithProviders(
      <LeaderboardView snapshot={snapshotOf(25)} user={null} withChrome={false} />,
    );
    expect(screen.getByTestId("league-divider-gold")).toBeInTheDocument();
    expect(screen.getByTestId("league-divider-silver")).toBeInTheDocument();
    expect(screen.queryByTestId("league-divider-bronze")).not.toBeInTheDocument();
  });

  it("inserts the three dividers when the list passes rank 30", () => {
    renderWithProviders(
      <LeaderboardView snapshot={snapshotOf(35)} user={null} withChrome={false} />,
    );
    expect(screen.getByTestId("league-divider-gold")).toBeInTheDocument();
    expect(screen.getByTestId("league-divider-silver")).toBeInTheDocument();
    expect(screen.getByTestId("league-divider-bronze")).toBeInTheDocument();
  });

  it("renders no dividers when the list is too short to reach rank 10", () => {
    renderWithProviders(
      <LeaderboardView snapshot={snapshotOf(8)} user={null} withChrome={false} />,
    );
    expect(screen.queryByTestId("league-divider-gold")).not.toBeInTheDocument();
    expect(screen.queryByTestId("league-divider-silver")).not.toBeInTheDocument();
    expect(screen.queryByTestId("league-divider-bronze")).not.toBeInTheDocument();
  });
});
