import type { UpcomingMatch } from "@/server/dashboard/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { MatchCard } from "./match-card";

const NOW = new Date("2026-06-12T10:00:00Z");

function buildMatch(overrides: Partial<UpcomingMatch> = {}): UpcomingMatch {
  return {
    matchId: "m1",
    stage: "group",
    kickoffAt: new Date("2026-06-12T21:00:00Z"),
    homeTeam: { name: "Argentina", flag: "🇦🇷", code: "ARG" },
    awayTeam: { name: "México", flag: "🇲🇽", code: "MEX" },
    prediction: null,
    ...overrides,
  };
}

describe("<MatchCard>", () => {
  it("renders 'Predecir' affordance when no prediction exists", () => {
    renderWithProviders(<MatchCard match={buildMatch()} now={NOW} />);
    // El card entero es un <Link>; el chip "Predecir" es decorativo.
    expect(screen.getByLabelText(/Predecir resultado/)).toBeInTheDocument();
  });

  it("renders 'Enviada' badge when prediction exists", () => {
    renderWithProviders(
      <MatchCard
        match={buildMatch({
          prediction: {
            kind: "exact",
            predictedWinner: null,
            predictedHomeScore: 2,
            predictedAwayScore: 1,
          },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Enviada/)).toBeInTheDocument();
    expect(screen.getByText(/2-1/)).toBeInTheDocument();
    expect(screen.getByText(/Editable/)).toBeInTheDocument();
  });

  it("renders TBD variant when teams are null", () => {
    const { container } = renderWithProviders(
      <MatchCard
        match={buildMatch({
          homeTeam: null,
          awayTeam: null,
          stage: "semi",
          kickoffAt: new Date("2026-07-09T19:00:00Z"),
        })}
        now={NOW}
      />,
    );
    // Layout vertical: dos placeholders `?` separados por `vs`.
    expect(screen.getAllByText("?").length).toBe(2);
    expect(screen.getByText(/Pendiente/)).toBeInTheDocument();
    // Sin botón "Predecir" cuando es TBD
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // aria-disabled marcado
    expect(container.querySelector("[aria-disabled='true']")).not.toBeNull();
  });

  it("shows 'Hoy' label and a kickoff time when match is today", () => {
    const { container } = renderWithProviders(<MatchCard match={buildMatch()} now={NOW} />);
    expect(screen.getByText(/Hoy/)).toBeInTheDocument();
    // <LocalTime> usa la timezone del runner para el texto visible.
    // El aria-label es estable en UTC y sirve de checkpoint.
    expect(container.querySelector('[aria-label="Kickoff: 21:00 UTC"]')).toBeInTheDocument();
  });

  it("shows 'Mañana' for tomorrow's matches", () => {
    renderWithProviders(
      <MatchCard match={buildMatch({ kickoffAt: new Date("2026-06-13T18:00:00Z") })} now={NOW} />,
    );
    expect(screen.getByText(/Mañana/)).toBeInTheDocument();
  });

  it("simple-home prediction renders 'Local'", () => {
    renderWithProviders(
      <MatchCard
        match={buildMatch({
          prediction: {
            kind: "simple",
            predictedWinner: "home",
            predictedHomeScore: null,
            predictedAwayScore: null,
          },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Local/)).toBeInTheDocument();
  });

  it("double-1x prediction renders 'Doble 1X'", () => {
    renderWithProviders(
      <MatchCard
        match={buildMatch({
          prediction: {
            kind: "double-1x",
            predictedWinner: null,
            predictedHomeScore: null,
            predictedAwayScore: null,
          },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Doble 1X/)).toBeInTheDocument();
  });

  it("renders an aria-label with both team names and the date", () => {
    renderWithProviders(<MatchCard match={buildMatch()} now={NOW} />);
    // El card es ahora un <Link> al detalle.
    expect(screen.getByRole("link", { name: /Argentina vs México/ })).toBeInTheDocument();
  });
});
