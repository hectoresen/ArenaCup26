import type { BracketData } from "@/server/matches/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { BracketView } from "./bracket-view";

const NOW = new Date("2026-06-12T10:00:00Z");

function emptyBracket(): BracketData {
  return {
    rounds: [
      { round: "round-of-16", matches: [] },
      { round: "quarter", matches: [] },
      { round: "semi", matches: [] },
      { round: "third-place", matches: [] },
      { round: "final", matches: [] },
    ],
  };
}

describe("<BracketView>", () => {
  it("renders all 5 round headers even with no matches", () => {
    renderWithProviders(<BracketView bracket={emptyBracket()} now={NOW} />);
    expect(screen.getByRole("heading", { name: "Octavos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cuartos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Semis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tercer puesto" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Final" })).toBeInTheDocument();
  });

  it("renders placeholder when a round has no matches", () => {
    renderWithProviders(<BracketView bracket={emptyBracket()} now={NOW} />);
    // 5 placeholders, uno por ronda vacía.
    const placeholders = screen.getAllByText(/aún sin partidos confirmados/);
    expect(placeholders).toHaveLength(5);
  });

  it("renders a BracketCard for each match within its round", () => {
    const bracket: BracketData = {
      ...emptyBracket(),
      rounds: [
        {
          round: "round-of-16",
          matches: [
            {
              matchId: "m1",
              stage: "round-of-16",
              kickoffAt: new Date("2026-06-29T18:00:00Z"),
              status: "scheduled",
              homeTeam: { name: "Argentina", flag: "🇦🇷", code: "ARG" },
              awayTeam: { name: "México", flag: "🇲🇽", code: "MEX" },
              homeScore: null,
              awayScore: null,
              minute: null,
              prediction: null,
            },
          ],
        },
        { round: "quarter", matches: [] },
        { round: "semi", matches: [] },
        { round: "third-place", matches: [] },
        { round: "final", matches: [] },
      ],
    };
    renderWithProviders(<BracketView bracket={bracket} now={NOW} />);
    // Cards usan code 3-letter como label corto.
    expect(screen.getByText("ARG")).toBeInTheDocument();
    expect(screen.getByText("MEX")).toBeInTheDocument();
    // Linked to detail.
    expect(screen.getByRole("link", { name: /Argentina vs México/ })).toBeInTheDocument();
  });

  it("shows score for a finished bracket match", () => {
    const bracket: BracketData = {
      ...emptyBracket(),
      rounds: [
        { round: "round-of-16", matches: [] },
        { round: "quarter", matches: [] },
        {
          round: "semi",
          matches: [
            {
              matchId: "m9",
              stage: "semi",
              kickoffAt: new Date("2026-07-08T20:00:00Z"),
              status: "finished",
              homeTeam: { name: "España", flag: "🇪🇸", code: "ESP" },
              awayTeam: { name: "Francia", flag: "🇫🇷", code: "FRA" },
              homeScore: 2,
              awayScore: 1,
              minute: null,
              prediction: null,
            },
          ],
        },
        { round: "third-place", matches: [] },
        { round: "final", matches: [] },
      ],
    };
    const { container } = renderWithProviders(<BracketView bracket={bracket} now={NOW} />);
    // El marcador se renderiza como "2 – 1" en un mismo div; usamos
    // el textContent del elemento para evitar la búsqueda por nodos.
    expect(container.textContent).toMatch(/2\s*–\s*1/);
  });

  it("shows 'Predicción enviada' badge for a scheduled match with prediction", () => {
    const bracket: BracketData = {
      ...emptyBracket(),
      rounds: [
        { round: "round-of-16", matches: [] },
        { round: "quarter", matches: [] },
        { round: "semi", matches: [] },
        { round: "third-place", matches: [] },
        {
          round: "final",
          matches: [
            {
              matchId: "m32",
              stage: "final",
              kickoffAt: new Date("2026-07-19T20:00:00Z"),
              status: "scheduled",
              homeTeam: { name: "Argentina", flag: "🇦🇷", code: "ARG" },
              awayTeam: { name: "Brasil", flag: "🇧🇷", code: "BRA" },
              homeScore: null,
              awayScore: null,
              minute: null,
              prediction: {
                kind: "exact",
                predictedWinner: null,
                predictedHomeScore: 3,
                predictedAwayScore: 1,
              },
            },
          ],
        },
      ],
    };
    renderWithProviders(<BracketView bracket={bracket} now={NOW} />);
    expect(screen.getByText(/Predicción enviada/)).toBeInTheDocument();
  });

  it("renders TBD card for a scheduled-tbd match (semi without seeded teams)", () => {
    const bracket: BracketData = {
      ...emptyBracket(),
      rounds: [
        { round: "round-of-16", matches: [] },
        { round: "quarter", matches: [] },
        {
          round: "semi",
          matches: [
            {
              matchId: "tbd1",
              stage: "semi",
              kickoffAt: new Date("2026-07-08T20:00:00Z"),
              status: "scheduled-tbd",
              homeTeam: null,
              awayTeam: null,
              homeScore: null,
              awayScore: null,
              minute: null,
              prediction: null,
            },
          ],
        },
        { round: "third-place", matches: [] },
        { round: "final", matches: [] },
      ],
    };
    const { container } = renderWithProviders(<BracketView bracket={bracket} now={NOW} />);
    expect(screen.getAllByText("?").length).toBe(2);
    expect(container.querySelector("[aria-disabled='true']")).not.toBeNull();
  });
});
