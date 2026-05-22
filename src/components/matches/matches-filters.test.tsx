import type { MatchesFilters } from "@/server/matches/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { MatchesFiltersBar } from "./matches-filters";

function buildFilters(overrides: Partial<MatchesFilters> = {}): MatchesFilters {
  return {
    status: "all",
    stage: "all",
    predictedOnly: false,
    ...overrides,
  };
}

describe("<MatchesFiltersBar>", () => {
  it("renders the 4 status chips + the predicted toggle", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={42} />);
    expect(screen.getByRole("link", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "En vivo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pronto" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acabados" })).toBeInTheDocument();
    // Toggle único (role=switch) "Mis predicciones".
    expect(screen.getByRole("switch", { name: /Mis predicciones/i })).toBeInTheDocument();
  });

  it("hides the stage filter group (Fase) — deferred to post-octavos", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={42} />);
    expect(screen.queryByRole("link", { name: "Grupos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Eliminatoria" })).not.toBeInTheDocument();
  });

  it("marks the active status chip with aria-current=page", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters({ status: "live" })} count={3} />);
    expect(screen.getByRole("link", { name: "En vivo" })).toHaveAttribute("aria-current", "page");
  });

  it("toggle exposes aria-checked according to predictedOnly", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={0} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    renderWithProviders(
      <MatchesFiltersBar active={buildFilters({ predictedOnly: true })} count={0} />,
    );
    const switches = screen.getAllByRole("switch");
    // El segundo render es el que está active.
    expect(switches[switches.length - 1]).toHaveAttribute("aria-checked", "true");
  });

  it("toggle href flips ON → OFF when active", () => {
    renderWithProviders(
      <MatchesFiltersBar active={buildFilters({ predictedOnly: true })} count={1} />,
    );
    // Cuando está ON, click va a OFF (sin param).
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("href")).toMatch(/\/partidos$/);
  });

  it("toggle href flips OFF → ON when inactive", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={1} />);
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("href")).toContain("mias=true");
  });

  it("omits defaults from status hrefs (clean URL)", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={0} />);
    const todos = screen.getByRole("link", { name: "Todos" });
    expect(todos.getAttribute("href")).toMatch(/\/partidos$/);
  });

  it("preserves the predicted toggle state when switching status", () => {
    renderWithProviders(
      <MatchesFiltersBar active={buildFilters({ status: "all", predictedOnly: true })} count={1} />,
    );
    const liveLink = screen.getByRole("link", { name: "En vivo" });
    const href = liveLink.getAttribute("href") ?? "";
    expect(href).toContain("status=live");
    expect(href).toContain("mias=true");
  });

  it("renders the result count badge", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={42} />);
    expect(screen.getByText(/42 resultados/)).toBeInTheDocument();
  });

  it("uses singular for count=1", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={1} />);
    expect(screen.getByText(/1 resultado$/)).toBeInTheDocument();
  });

  it("uses zero copy for count=0", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={0} />);
    expect(screen.getByText(/Sin resultados/)).toBeInTheDocument();
  });
});
