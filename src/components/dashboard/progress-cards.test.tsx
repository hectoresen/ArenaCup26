import type { Progress } from "@/server/dashboard/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { ProgressCards } from "./progress-cards";

const NOW = new Date("2026-06-13T10:00:00Z");

function buildProgress(overrides: Partial<Progress> = {}): Progress {
  return {
    rank: { rank: 42, rankDelta: null, sparkline: null },
    achievements: {
      unlocked: 8,
      total: 24,
      lastUnlockedTitle: "Buen Ojo",
      lastUnlockedAt: new Date("2026-06-11T10:00:00Z"),
    },
    ...overrides,
  };
}

describe("<ProgressCards>", () => {
  it("renders achievements as 'X / Y' with the last unlocked", () => {
    renderWithProviders(<ProgressCards progress={buildProgress()} now={NOW} />);
    expect(screen.getByText(/^8$/)).toBeInTheDocument();
    expect(screen.getByText(/\/ 24/)).toBeInTheDocument();
    expect(screen.getByText(/Buen Ojo/)).toBeInTheDocument();
  });

  it("'hace 2 d' when last unlocked 2 days ago", () => {
    renderWithProviders(<ProgressCards progress={buildProgress()} now={NOW} />);
    expect(screen.getByText(/hace 2 d/)).toBeInTheDocument();
  });

  it("shows 'Aún sin desbloquear' when no achievements unlocked", () => {
    renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          achievements: { unlocked: 0, total: 24, lastUnlockedTitle: null, lastUnlockedAt: null },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Aún sin desbloquear/)).toBeInTheDocument();
  });

  it("renders rank as '#42'", () => {
    renderWithProviders(<ProgressCards progress={buildProgress()} now={NOW} />);
    expect(screen.getByText("#42")).toBeInTheDocument();
  });

  it("shows the placeholder 'Empezamos a registrar el 11 de junio' when there's no history", () => {
    renderWithProviders(<ProgressCards progress={buildProgress()} now={NOW} />);
    expect(screen.getByText(/Empezamos a registrar el 11 de junio/)).toBeInTheDocument();
  });

  it("shows '▲ +3 posiciones esta semana' when rankDelta > 0", () => {
    renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          rank: { rank: 42, rankDelta: 3, sparkline: [] },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/▲ \+3 posiciones esta semana/)).toBeInTheDocument();
    // Y el placeholder desaparece
    expect(screen.queryByText(/Empezamos a registrar el 11 de junio/)).not.toBeInTheDocument();
  });

  it("shows '▼ 2 posiciones esta semana' when rankDelta < 0", () => {
    renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          rank: { rank: 42, rankDelta: -2, sparkline: [] },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/▼ 2 posiciones esta semana/)).toBeInTheDocument();
  });

  it("shows 'Sin cambios esta semana' when rankDelta === 0", () => {
    renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          rank: { rank: 42, rankDelta: 0, sparkline: [] },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Sin cambios esta semana/)).toBeInTheDocument();
  });

  it("renders the tail rank for a user without points (ranking is inamovible)", () => {
    renderWithProviders(
      <ProgressCards
        progress={buildProgress({ rank: { rank: 12480, rankDelta: null, sparkline: null } })}
        now={NOW}
      />,
    );
    expect(screen.getByText("#12480")).toBeInTheDocument();
  });
});
