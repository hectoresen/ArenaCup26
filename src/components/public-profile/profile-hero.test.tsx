import type { ProfileIdentity } from "@/server/public-profile/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { ProfileHero } from "./profile-hero";

function buildIdentity(overrides: Partial<ProfileIdentity> = {}): ProfileIdentity {
  return {
    name: "Carlos Mendoza",
    username: "carlos-mendoza",
    country: "MX",
    flag: "🇲🇽",
    image: null,
    ...overrides,
  };
}

describe("<ProfileHero>", () => {
  it("renders name, handle and country pill", () => {
    renderWithProviders(<ProfileHero identity={buildIdentity()} />);
    expect(screen.getByText("Carlos Mendoza")).toBeInTheDocument();
    expect(screen.getByText("@carlos-mendoza")).toBeInTheDocument();
    expect(screen.getByText("MX")).toBeInTheDocument();
  });

  it("renders the first initial when no image is provided", () => {
    renderWithProviders(<ProfileHero identity={buildIdentity({ image: null })} />);
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("renders an <img> when image URL is provided", () => {
    const { container } = renderWithProviders(
      <ProfileHero identity={buildIdentity({ image: "https://example.com/me.jpg" })} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/me.jpg");
  });

  it("hides the country pill when country is null", () => {
    renderWithProviders(<ProfileHero identity={buildIdentity({ country: null, flag: null })} />);
    // No "MX" pill cuando no hay país.
    expect(screen.queryByText("MX")).not.toBeInTheDocument();
  });

  it("includes a 'Copy link' button", () => {
    renderWithProviders(<ProfileHero identity={buildIdentity()} />);
    expect(screen.getByRole("button", { name: /Copiar enlace/i })).toBeInTheDocument();
  });
});
