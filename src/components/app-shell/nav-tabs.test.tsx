import { describe, expect, it } from "vitest";
import { APP_SHELL_TABS, isTabActive } from "./nav-tabs";

describe("APP_SHELL_TABS", () => {
  it("contains exactly the 4 expected tabs in order", () => {
    expect(APP_SHELL_TABS.map((t) => t.labelKey)).toEqual([
      "home",
      "matches",
      "ranking",
      "social",
    ]);
  });

  it("each tab has a unique href and iconId", () => {
    const hrefs = new Set(APP_SHELL_TABS.map((t) => t.href as string));
    const icons = new Set(APP_SHELL_TABS.map((t) => t.iconId));
    expect(hrefs.size).toBe(APP_SHELL_TABS.length);
    expect(icons.size).toBe(APP_SHELL_TABS.length);
  });
});

describe("isTabActive", () => {
  it.each([
    ["/inicio", "/inicio", true],
    ["/inicio/", "/inicio", true], // trailing slash sigue siendo el tab inicio
    ["/partidos", "/inicio", false],
    ["/partidos/abc-123", "/partidos", true], // sub-ruta activa el tab padre
    ["/partidoswhatever", "/partidos", false], // no es sub-ruta (no hay `/`)
    ["/", "/inicio", false],
  ] as const)("isTabActive('%s', '%s') → %s", (pathname, tabHref, expected) => {
    expect(isTabActive(pathname, tabHref)).toBe(expected);
  });
});
