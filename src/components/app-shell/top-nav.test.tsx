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

// Importar DESPUÉS del mock para que el módulo lea la versión parchada.
const { TopNav } = await import("./top-nav");
const { ShellIconSprite } = await import("./icons");

function renderTopNav(pathname: string) {
  currentPathname = pathname;
  return renderWithProviders(
    <>
      <ShellIconSprite />
      <TopNav trailing={<span data-testid="trailing">trailing</span>} />
    </>,
  );
}

describe("<TopNav>", () => {
  it("renders the 4 tabs with their labels", () => {
    renderTopNav("/inicio");
    expect(screen.getByRole("link", { name: /^Inicio$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Partidos$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Ranking$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Logros$/ })).toBeInTheDocument();
  });

  it("marks aria-current='page' on the active tab", () => {
    renderTopNav("/partidos");
    const tab = screen.getByRole("link", { name: /^Partidos$/ });
    expect(tab.getAttribute("aria-current")).toBe("page");
    // los otros tres no
    expect(screen.getByRole("link", { name: /^Inicio$/ }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: /^Ranking$/ }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: /^Logros$/ }).getAttribute("aria-current")).toBeNull();
  });

  it("active tab also matches when on a sub-route", () => {
    renderTopNav("/partidos/uuid-match-1");
    expect(screen.getByRole("link", { name: /^Partidos$/ }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("mounts the trailing slot (notification + avatar/menu)", () => {
    renderTopNav("/inicio");
    expect(screen.getByTestId("trailing")).toBeInTheDocument();
  });

  it("logo link points to /inicio", () => {
    renderTopNav("/partidos");
    // El logo tiene aria-label propio (no se confunde con el tab Inicio).
    const logo = screen.getByLabelText(/ArenaCup26.*inicio/i);
    expect(logo.getAttribute("href")).toMatch(/\/inicio$/);
  });
});
