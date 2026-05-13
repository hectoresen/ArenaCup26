import type { LiveMatchView, UpcomingHeroView } from "@/server/dashboard/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { LiveSection } from "./live-section";

const NOW = new Date("2026-06-12T10:00:00Z");

const liveMatch: LiveMatchView = {
  matchId: "live1",
  stage: "group",
  homeTeam: { name: "España", flag: "🇪🇸", code: "ESP" },
  awayTeam: { name: "Brasil", flag: "🇧🇷", code: "BRA" },
  homeScore: 2,
  awayScore: 1,
  minute: 67,
  prediction: {
    kind: "exact",
    predictedWinner: null,
    predictedHomeScore: 2,
    predictedAwayScore: 1,
  },
};

const nextMatch: UpcomingHeroView = {
  matchId: "next1",
  stage: "group",
  kickoffAt: new Date("2026-06-12T21:00:00Z"),
  homeTeam: { name: "Argentina", flag: "🇦🇷", code: "ARG" },
  awayTeam: { name: "México", flag: "🇲🇽", code: "MEX" },
};

describe("<LiveSection>", () => {
  it("renders 'En vivo ahora' + LiveCard when there is a live match", () => {
    renderWithProviders(<LiveSection live={liveMatch} nextMatch={null} now={NOW} />);
    expect(screen.getByText("En vivo ahora")).toBeInTheDocument();
    expect(screen.getByText("España")).toBeInTheDocument();
    expect(screen.getByText(/Min\. 67/)).toBeInTheDocument();
    expect(screen.getByText(/2 — 1/)).toBeInTheDocument();
  });

  it("renders 'Próximo partido' + UpcomingHeroCard when no live but there is a next match", () => {
    renderWithProviders(<LiveSection live={null} nextMatch={nextMatch} now={NOW} />);
    expect(screen.getByText("Próximo partido")).toBeInTheDocument();
    expect(screen.getByText("Argentina")).toBeInTheDocument();
    expect(screen.getByText("México")).toBeInTheDocument();
    // No render del literal de live
    expect(screen.queryByText("En vivo ahora")).not.toBeInTheDocument();
  });

  it("renders NOTHING when both live and next are null", () => {
    const { container } = renderWithProviders(
      <LiveSection live={null} nextMatch={null} now={NOW} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 'Provisional' + 'Se calcula al final del partido' inside the live card", () => {
    renderWithProviders(<LiveSection live={liveMatch} nextMatch={null} now={NOW} />);
    expect(screen.getByText("Provisional")).toBeInTheDocument();
    expect(screen.getByText(/Se calcula al final del partido/)).toBeInTheDocument();
  });

  it("renders 'No predijiste este partido' when user has no prediction", () => {
    renderWithProviders(
      <LiveSection live={{ ...liveMatch, prediction: null }} nextMatch={null} now={NOW} />,
    );
    expect(screen.getByText(/No predijiste este partido/)).toBeInTheDocument();
    expect(screen.queryByText("Provisional")).not.toBeInTheDocument();
  });

  it("prefers live over nextMatch when both are present", () => {
    renderWithProviders(<LiveSection live={liveMatch} nextMatch={nextMatch} now={NOW} />);
    expect(screen.getByText("En vivo ahora")).toBeInTheDocument();
    expect(screen.queryByText("Próximo partido")).not.toBeInTheDocument();
  });
});
