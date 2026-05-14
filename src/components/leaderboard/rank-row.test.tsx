import type { Player } from "@/lib/leaderboard/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { RankRow } from "./rank-row";

const basePlayer: Player = {
  id: "u1",
  name: "Carlos Mendoza",
  countryCode: "MX",
  countryName: "México",
  flag: "🇲🇽",
  points: 4820,
  streak: 7,
  correctCount: 34,
  rank: 4,
  previousRank: 4,
};

describe("RankRow", () => {
  it("renders rank, name and formatted points", () => {
    renderWithProviders(<RankRow player={basePlayer} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Carlos Mendoza")).toBeInTheDocument();
    // toLocaleString("es-ES") => "4.820"
    expect(screen.getByText("4.820")).toBeInTheDocument();
  });

  it("shows the streak counter when streak ≥ 3", () => {
    renderWithProviders(<RankRow player={basePlayer} />);
    expect(screen.getByText(/×7/)).toBeInTheDocument();
  });

  it("shows the 'sin racha' label when streak < 3", () => {
    renderWithProviders(<RankRow player={{ ...basePlayer, streak: 1 }} />);
    expect(screen.getByText("sin racha")).toBeInTheDocument();
  });

  it("includes the correct-count badge", () => {
    renderWithProviders(<RankRow player={basePlayer} />);
    expect(screen.getByText(/34 acertadas/)).toBeInTheDocument();
  });
});
