import type { Progress } from "@/server/dashboard/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { ProgressCards } from "./progress-cards";

const NOW = new Date("2026-06-13T10:00:00Z");

function buildProgress(overrides: Partial<Progress> = {}): Progress {
  return {
    rank: { rank: 42, rankDelta: null, dayAgoRank: null, sparkline: null },
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

  it("shows '▲ +3 posiciones en 24h' when current rank improved 3 spots vs ayer", () => {
    // dayAgoRank=45, rank=42 → delta=+3 (subió 3). El delta se
    // calcula en el cliente con dayAgoRank vs rank live (vía SSE).
    renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          rank: { rank: 42, rankDelta: 3, dayAgoRank: 45, sparkline: [45, 44, 43, 42] },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/▲ \+3 posiciones en 24h/)).toBeInTheDocument();
    expect(screen.queryByText(/Empezamos a registrar el 11 de junio/)).not.toBeInTheDocument();
  });

  it("shows '▼ 2 posiciones en 24h' when current rank dropped 2 spots vs ayer", () => {
    // dayAgoRank=40, rank=42 → delta=-2 (bajó 2).
    renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          rank: { rank: 42, rankDelta: -2, dayAgoRank: 40, sparkline: [40, 41, 42, 42] },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/▼ 2 posiciones en 24h/)).toBeInTheDocument();
  });

  it("shows 'Sin cambios en 24h' when rank stayed flat", () => {
    renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          rank: { rank: 42, rankDelta: 0, dayAgoRank: 42, sparkline: [42, 42, 42, 42] },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Sin cambios en 24h/)).toBeInTheDocument();
  });

  it("renders the tail rank for a user without points (ranking is inamovible)", () => {
    renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          rank: { rank: 12480, rankDelta: null, dayAgoRank: null, sparkline: null },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText("#12480")).toBeInTheDocument();
  });

  it("renders an SVG sparkline when history has ≥2 points", () => {
    const { container } = renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          rank: { rank: 38, rankDelta: 4, dayAgoRank: 42, sparkline: [42, 41, 40, 39, 38, 38, 38] },
        })}
        now={NOW}
      />,
    );
    const svg = container.querySelector("svg[aria-label]");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("path")).not.toBeNull();
  });

  it("does not render sparkline when history has only one snapshot", () => {
    const { container } = renderWithProviders(
      <ProgressCards
        progress={buildProgress({
          rank: { rank: 38, rankDelta: 0, dayAgoRank: 38, sparkline: [38] },
        })}
        now={NOW}
      />,
    );
    expect(container.querySelector("svg[aria-label]")).toBeNull();
  });
});
