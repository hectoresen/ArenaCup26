import type { ProfileStats } from "@/server/public-profile/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { StatsRow } from "./stats-row";

function buildStats(overrides: Partial<ProfileStats> = {}): ProfileStats {
  return {
    rank: 42,
    totalPlayers: 12480,
    points: 1840,
    pointsDelta: null,
    ...overrides,
  };
}

describe("<StatsRow>", () => {
  it("renders rank as #42 and points as 1.840", () => {
    renderWithProviders(<StatsRow stats={buildStats()} isOwner={true} />);
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("1.840")).toBeInTheDocument();
  });

  it("formats total players with es-ES separator in the subtitle", () => {
    renderWithProviders(<StatsRow stats={buildStats()} isOwner={true} />);
    expect(screen.getByText(/de 12\.480 jugadores/)).toBeInTheDocument();
  });

  it("shows the real tail rank for a user with no points (ranking is inamovible)", () => {
    renderWithProviders(
      <StatsRow stats={buildStats({ rank: 12480, totalPlayers: 12480, points: 0 })} isOwner={true} />,
    );
    expect(screen.getByText("#12480")).toBeInTheDocument();
  });

  it("shows '0' as points when user has none", () => {
    renderWithProviders(<StatsRow stats={buildStats({ points: 0, rank: 12480 })} isOwner={true} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("does not show a delta line when pointsDelta is null (history pending)", () => {
    renderWithProviders(<StatsRow stats={buildStats()} isOwner={true} />);
    expect(screen.queryByText(/▲/)).not.toBeInTheDocument();
    expect(screen.queryByText(/▼/)).not.toBeInTheDocument();
  });
});
