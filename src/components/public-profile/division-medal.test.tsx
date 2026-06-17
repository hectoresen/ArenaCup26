import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { DivisionMedal } from "./division-medal";

describe("<DivisionMedal>", () => {
  it("renders the gold medal with its label", () => {
    renderWithProviders(<DivisionMedal division="gold" />);
    expect(screen.getByTestId("division-medal-gold")).toBeInTheDocument();
    expect(screen.getByText("División de Oro")).toBeInTheDocument();
  });

  it("renders the silver medal with its label", () => {
    renderWithProviders(<DivisionMedal division="silver" />);
    expect(screen.getByTestId("division-medal-silver")).toBeInTheDocument();
    expect(screen.getByText("División de Plata")).toBeInTheDocument();
  });

  it("renders the bronze medal with its label", () => {
    renderWithProviders(<DivisionMedal division="bronze" />);
    expect(screen.getByTestId("division-medal-bronze")).toBeInTheDocument();
    expect(screen.getByText("División de Bronce")).toBeInTheDocument();
  });

  it("exposes the division in an accessible aria-label", () => {
    renderWithProviders(<DivisionMedal division="gold" />);
    const medal = screen.getByTestId("division-medal-gold");
    expect(medal.getAttribute("aria-label")).toMatch(/División de Oro/);
  });

  it("tags the SVG and copy with the same data-division attribute", () => {
    renderWithProviders(<DivisionMedal division="bronze" />);
    expect(screen.getByTestId("division-medal-bronze").getAttribute("data-division")).toBe(
      "bronze",
    );
  });
});
