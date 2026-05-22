import type { UserStats } from "@/server/dashboard/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { Hero } from "./hero";

const baseStats: UserStats = {
  totalPoints: 1840,
  streak: 5,
  correctCount: 12,
  achievementsUnlocked: 8,
  achievementsTotal: 24,
  rank: 42,
  totalPlayers: 12480,
};

describe("<Hero>", () => {
  it("renders the greeting with the first name in gold", () => {
    const { container } = renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(container.textContent).toMatch(/Hola, .*Carlos.* 👋/);
    const em = container.querySelector("em");
    expect(em?.textContent).toBe("Carlos");
  });

  it("uses 'Bienvenido' when the name is empty", () => {
    renderWithProviders(<Hero userName="" stats={baseStats} />);
    expect(screen.getByText(/Bienvenido/)).toBeInTheDocument();
  });

  it("renders the subtitle with rank and total players", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(screen.getByText(/#42 de 12.480 jugadores/)).toBeInTheDocument();
  });

  it("uses 'Empieza tu primera predicción' for a new user (totalPoints=0) but still shows real rank", () => {
    renderWithProviders(
      <Hero userName="Carlos Mendoza" stats={{ ...baseStats, rank: 12480, totalPoints: 0 }} />,
    );
    expect(screen.getByText(/Empieza tu primera predicción/)).toBeInTheDocument();
    expect(screen.queryByText(/de 12.480 jugadores/)).not.toBeInTheDocument();
    expect(screen.getByText("#12480")).toBeInTheDocument();
  });

  it("formats points with es-ES separator (4820 → 4.820)", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(screen.getByText("1.840")).toBeInTheDocument();
  });

  it("shows streak chip 🔥 next to greeting when streak ≥ 1", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(screen.getByText(/🔥/)).toBeInTheDocument();
    expect(screen.getByText(/Racha 5/)).toBeInTheDocument();
  });

  it("does not show streak chip when streak is 0", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={{ ...baseStats, streak: 0 }} />);
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument();
  });

  it("shows rank '#N' in the middle mini-stat when ranked", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(screen.getByText("#42")).toBeInTheDocument();
  });

  it("shows achievements fraction X/Y", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(screen.getByText("8/24")).toBeInTheDocument();
  });

  it("'Mi posición' mini-stat links to /ranking", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    const link = screen.getByRole("link", { name: /Mi posición 42/i });
    expect(link.getAttribute("href")).toMatch(/\/ranking$/);
  });

  it("'Logros' mini-stat links to /logros", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    const link = screen.getByRole("link", { name: /8 Logros 24/i });
    expect(link.getAttribute("href")).toMatch(/\/logros$/);
  });

  it("'Puntos' mini-stat is NOT a link (it's a stat, not a destination)", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(screen.queryByRole("link", { name: /Puntos/ })).toBeNull();
  });
});
