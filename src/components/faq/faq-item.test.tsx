import { renderWithProviders, screen, userEvent } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { FaqItem } from "./faq-item";

describe("FaqItem", () => {
  it("renders the question and the answer body", () => {
    renderWithProviders(<FaqItem question="¿Cómo funciona?">Respuesta de ejemplo.</FaqItem>);
    expect(screen.getByText("¿Cómo funciona?")).toBeInTheDocument();
    expect(screen.getByText("Respuesta de ejemplo.")).toBeInTheDocument();
  });

  it("starts closed and toggles open on click", async () => {
    renderWithProviders(<FaqItem question="P">A</FaqItem>);
    const summary = screen.getByText("P");
    const details = summary.closest("details") as HTMLDetailsElement;

    expect(details.open).toBe(false);

    await userEvent.setup().click(summary);
    expect(details.open).toBe(true);

    await userEvent.setup().click(summary);
    expect(details.open).toBe(false);
  });
});
