import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { AppAvatar, avatarInitials } from "./app-avatar";

describe("avatarInitials", () => {
  it.each([
    ["Carlos Mendoza", "CM"],
    ["Layla", "L"],
    ["María José García", "MJ"],
    ["a b c", "AB"],
    ["  espacios  ", "E"],
    [null, "?"],
    [undefined, "?"],
    ["", "?"],
    ["   ", "?"],
  ] as const)("'%s' → '%s'", (input, expected) => {
    expect(avatarInitials(input)).toBe(expected);
  });
});

describe("<AppAvatar>", () => {
  it("renders initials when no image is provided", () => {
    renderWithProviders(<AppAvatar user={{ name: "Carlos Mendoza", image: null }} />);
    expect(screen.getByText("CM")).toBeInTheDocument();
  });

  it("renders <img> when image URL is provided", () => {
    renderWithProviders(
      <AppAvatar user={{ name: "Carlos Mendoza", image: "https://example.com/me.jpg" }} />,
    );
    const img = screen.getByRole("img", { name: /Carlos Mendoza/i });
    // El <img> está dentro del span con role=img; basta con asegurar que se
    // monta el <img> hijo (no las iniciales).
    expect(img.querySelector("img")).not.toBeNull();
    expect(img.querySelector("img")?.getAttribute("src")).toBe("https://example.com/me.jpg");
  });

  it("uses an aria-label with the user name", () => {
    renderWithProviders(<AppAvatar user={{ name: "Layla Hassan", image: null }} />);
    expect(screen.getByRole("img", { name: /Layla Hassan/i })).toBeInTheDocument();
  });

  it("renders the conic-gradient ring class (visual contract)", () => {
    renderWithProviders(<AppAvatar user={{ name: "Yuki Tanaka", image: null }} />);
    const ring = screen.getByRole("img", { name: /Yuki Tanaka/i });
    expect(ring.className).toMatch(/conic-gradient/);
  });
});
