import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { MatchesFiltersBar } from "./matches-filters";
import type { MatchesFilters } from "@/server/matches/types";

function buildFilters(overrides: Partial<MatchesFilters> = {}): MatchesFilters {
  return {
    status: "all",
    stage: "all",
    predictedOnly: false,
    ...overrides,
  };
}

describe("<MatchesFiltersBar>", () => {
  it("renders the 3 filter groups with their options", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={42} />);
    // "Todos" aparece en 2 grupos (status + stage) — usamos
    // getAllByRole para ambos y verificamos que uno de cada está.
    const todosLinks = screen.getAllByRole("link", { name: "Todos" });
    expect(todosLinks.length).toBeGreaterThanOrEqual(2);
    // Status group (chips únicos)
    expect(screen.getByRole("link", { name: "En vivo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pronto" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acabados" })).toBeInTheDocument();
    // Stage group (chips únicos)
    expect(screen.getByRole("link", { name: "Grupos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Eliminatoria" })).toBeInTheDocument();
    // Predicted group
    expect(screen.getByRole("link", { name: "Solo mis predicciones" })).toBeInTheDocument();
  });

  it("marks the active chip with aria-current=page", () => {
    renderWithProviders(
      <MatchesFiltersBar active={buildFilters({ status: "live" })} count={3} />,
    );
    expect(screen.getByRole("link", { name: "En vivo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("omits defaults from the href (clean URL)", () => {
    renderWithProviders(<MatchesFiltersBar active={buildFilters()} count={0} />);
    const todos = screen.getAllByRole("link", { name: "Todos" });
    // Ambos "Todos" (status y stage) apuntan a la URL limpia cuando
    // todos los filtros están en default.
    for (const link of todos) {
      expect(link.getAttribute("href")).toMatch(/\/partidos$/);
    }
  });

  it("preserves other active filters when changing one", () => {
    renderWithProviders(
      <MatchesFiltersBar
        active={buildFilters({ status: "live", predictedOnly: true })}
        count={1}
      />,
    );
    // Click on stage=knockout should keep status=live and mias=true.
    const knockout = screen.getByRole("link", { name: "Eliminatoria" });
    const href = knockout.getAttribute("href") ?? "";
    expect(href).toContain("status=live");
    expect(href).toContain("stage=knockout");
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
