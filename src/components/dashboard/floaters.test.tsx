import { renderWithProviders } from "@/test/render-with-providers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Floaters } from "./floaters";

function mockMatchMedia(reduced: boolean) {
  const mql = {
    matches: reduced,
    media: "",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation(() => mql),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<Floaters>", () => {
  it("renders 7 floaters when reduced-motion is OFF", () => {
    mockMatchMedia(false);
    const { container } = renderWithProviders(<Floaters />);
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(7);
  });

  it("renders NOTHING when reduced-motion is ON", () => {
    mockMatchMedia(true);
    const { container } = renderWithProviders(<Floaters />);
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(0);
  });

  it("each floater has a soccer-ball glyph", () => {
    mockMatchMedia(false);
    const { container } = renderWithProviders(<Floaters />);
    const nodes = container.querySelectorAll("[aria-hidden='true']");
    for (const node of nodes) {
      expect(node.textContent).toBe("⚽");
    }
  });
});
