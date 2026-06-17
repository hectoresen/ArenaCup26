import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { LEAGUE_DIVIDERS, LeagueDivider } from "./league-divider";

describe("LeagueDivider", () => {
  it("renders the tier-specific test id for each variant", () => {
    const { rerender } = renderWithProviders(<LeagueDivider tier="gold" />);
    expect(screen.getByTestId("league-divider-gold")).toBeInTheDocument();
    rerender(<LeagueDivider tier="silver" />);
    expect(screen.getByTestId("league-divider-silver")).toBeInTheDocument();
    rerender(<LeagueDivider tier="bronze" />);
    expect(screen.getByTestId("league-divider-bronze")).toBeInTheDocument();
  });

  it("is hidden from assistive tech (purely decorative)", () => {
    renderWithProviders(<LeagueDivider tier="gold" />);
    expect(screen.getByTestId("league-divider-gold")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LEAGUE_DIVIDERS table", () => {
  it("maps the canonical cutoffs 10/20/30 to gold/silver/bronze", () => {
    expect(LEAGUE_DIVIDERS[10]).toBe("gold");
    expect(LEAGUE_DIVIDERS[20]).toBe("silver");
    expect(LEAGUE_DIVIDERS[30]).toBe("bronze");
  });

  it("returns undefined for any other rank", () => {
    expect(LEAGUE_DIVIDERS[9]).toBeUndefined();
    expect(LEAGUE_DIVIDERS[11]).toBeUndefined();
    expect(LEAGUE_DIVIDERS[40]).toBeUndefined();
  });
});
