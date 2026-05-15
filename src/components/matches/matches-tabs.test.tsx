import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { MatchesTabs } from "./matches-tabs";

describe("<MatchesTabs>", () => {
  it("renders both tabs as links", () => {
    renderWithProviders(<MatchesTabs active="todos" />);
    expect(screen.getByRole("link", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bracket" })).toBeInTheDocument();
  });

  it("marks active tab with aria-current=page", () => {
    renderWithProviders(<MatchesTabs active="bracket" />);
    const active = screen.getByRole("link", { name: "Bracket" });
    expect(active).toHaveAttribute("aria-current", "page");
    const inactive = screen.getByRole("link", { name: "Todos" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("Todos link has no query param (default view)", () => {
    renderWithProviders(<MatchesTabs active="bracket" />);
    const todos = screen.getByRole("link", { name: "Todos" });
    expect(todos.getAttribute("href")).toMatch(/\/partidos$/);
  });

  it("Bracket link carries ?vista=bracket", () => {
    renderWithProviders(<MatchesTabs active="todos" />);
    const bracket = screen.getByRole("link", { name: "Bracket" });
    expect(bracket.getAttribute("href")).toMatch(/\/partidos\?vista=bracket$/);
  });
});
