import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it, vi } from "vitest";

let currentPathname = "/inicio";

vi.mock("@/i18n/navigation", async () => {
  const actual = await vi.importActual<typeof import("@/i18n/navigation")>("@/i18n/navigation");
  return {
    ...actual,
    usePathname: () => currentPathname,
  };
});

const { BottomNav } = await import("./bottom-nav");
const { ShellIconSprite } = await import("./icons");

function renderBottomNav(pathname: string) {
  currentPathname = pathname;
  return renderWithProviders(
    <>
      <ShellIconSprite />
      <BottomNav />
    </>,
  );
}

describe("<BottomNav>", () => {
  it("renders the same 4 tabs as TopNav (consistency)", () => {
    renderBottomNav("/inicio");
    expect(screen.getByRole("link", { name: /^Inicio$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Partidos$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Ranking$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Logros$/i })).toBeInTheDocument();
  });

  it("marks the active tab via aria-current", () => {
    renderBottomNav("/logros");
    expect(screen.getByRole("link", { name: /^Logros$/i }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("hides the nav on viewports >= 640px (CSS class signature)", () => {
    renderBottomNav("/inicio");
    const nav = screen.getByRole("navigation");
    // Tailwind `hidden ... max-sm:flex` ⇒ por defecto hidden, en max-sm:flex.
    expect(nav.className).toMatch(/\bhidden\b/);
    expect(nav.className).toMatch(/max-sm:flex/);
  });
});
