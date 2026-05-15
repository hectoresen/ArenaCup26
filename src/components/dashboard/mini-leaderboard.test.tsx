import type { LeaderboardEntry, MiniLeaderboardView } from "@/server/dashboard/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { MiniLeaderboard } from "./mini-leaderboard";

function entry(rank: number, userId: string, points = 5000 - rank * 100): LeaderboardEntry {
  return {
    userId,
    name: `User ${userId.toUpperCase()}`,
    countryCode: "MX",
    points,
    rank,
  };
}

describe("<MiniLeaderboard>", () => {
  const top: LeaderboardEntry[] = [entry(1, "u1"), entry(2, "u2"), entry(3, "u3")];

  it("renders the top entries", () => {
    const view: MiniLeaderboardView = { top, me: null };
    renderWithProviders(<MiniLeaderboard mini={view} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("renders the separator + me row when me is outside the top", () => {
    const view: MiniLeaderboardView = {
      top,
      me: { ...entry(42, "me", 1840), name: "Carlos Mendoza" },
    };
    const { container } = renderWithProviders(<MiniLeaderboard mini={view} />);
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("Carlos Mendoza", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/\(tú\)/)).toBeInTheDocument();
    // El separator solo está cuando hay me.
    expect(container.querySelector("[data-testid='mini-leaderboard-separator']")).not.toBeNull();
  });

  it("hides separator + (tú) when me is null (already in top)", () => {
    const view: MiniLeaderboardView = { top, me: null };
    const { container } = renderWithProviders(<MiniLeaderboard mini={view} />);
    expect(container.querySelector("[data-testid='mini-leaderboard-separator']")).toBeNull();
    expect(screen.queryByText(/\(tú\)/)).not.toBeInTheDocument();
  });

  it("formats points with es-ES separator", () => {
    const view: MiniLeaderboardView = {
      top: [{ ...entry(1, "u1"), points: 4610 }],
      me: null,
    };
    renderWithProviders(<MiniLeaderboard mini={view} />);
    expect(screen.getByText("4.610")).toBeInTheDocument();
  });

  it("aria-label for 'me' row mentions 'Tu posición'", () => {
    const view: MiniLeaderboardView = {
      top,
      me: { ...entry(42, "me", 1840), name: "Carlos" },
    };
    renderWithProviders(<MiniLeaderboard mini={view} />);
    expect(screen.getByRole("listitem", { name: /Tu posición.*42/ })).toBeInTheDocument();
  });

  it("renders 'Ver ranking completo' CTA linking to /ranking", () => {
    const view: MiniLeaderboardView = { top, me: null };
    renderWithProviders(<MiniLeaderboard mini={view} />);
    const link = screen.getByRole("link", { name: /Ver ranking completo/ });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toMatch(/\/ranking$/);
  });
});
