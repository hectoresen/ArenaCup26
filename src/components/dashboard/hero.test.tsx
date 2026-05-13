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

  it("uses 'Empieza tu primera predicción' when rank is null (new user)", () => {
    renderWithProviders(
      <Hero userName="Carlos Mendoza" stats={{ ...baseStats, rank: null, totalPoints: 0 }} />,
    );
    expect(screen.getByText(/Empieza tu primera predicción/)).toBeInTheDocument();
    expect(screen.queryByText(/de 12.480 jugadores/)).not.toBeInTheDocument();
  });

  it("formats points with es-ES separator (4820 → 4.820)", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(screen.getByText("1.840")).toBeInTheDocument();
  });

  it("shows '🔥 5' when streak ≥ 3", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(screen.getByText(/🔥 5/)).toBeInTheDocument();
    expect(screen.getByText("En racha")).toBeInTheDocument();
  });

  it("shows 'Sin racha' label when streak < 3", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={{ ...baseStats, streak: 1 }} />);
    expect(screen.getByText("Sin racha")).toBeInTheDocument();
  });

  it("shows achievements fraction X/Y", () => {
    renderWithProviders(<Hero userName="Carlos Mendoza" stats={baseStats} />);
    expect(screen.getByText("8/24")).toBeInTheDocument();
  });
});
