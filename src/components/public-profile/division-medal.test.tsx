import { renderWithProviders, screen } from "@/test/render-with-providers";
import { fireEvent } from "@testing-library/react";
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

  it("tags the trigger with the same data-division attribute", () => {
    renderWithProviders(<DivisionMedal division="bronze" />);
    expect(screen.getByTestId("division-medal-bronze").getAttribute("data-division")).toBe(
      "bronze",
    );
  });

  it("trigger is a button with the correct aria-haspopup", () => {
    renderWithProviders(<DivisionMedal division="silver" />);
    const trigger = screen.getByTestId("division-medal-silver");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking the trigger opens the info dialog with the tier-specific body", () => {
    renderWithProviders(<DivisionMedal division="gold" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("division-medal-gold"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // El body explica algo específico del oro (top 10 y caer a plata).
    expect(dialog.textContent).toMatch(/top 10/i);
    expect(dialog.textContent).toMatch(/Plata/);
  });

  it("dialog includes the 'Ver más' link pointing to the FAQ anchor", () => {
    renderWithProviders(<DivisionMedal division="silver" />);
    fireEvent.click(screen.getByTestId("division-medal-silver"));

    const viewMore = screen.getByRole("link", { name: /Ver más/i });
    expect(viewMore.getAttribute("href")).toMatch(/\/faq#faq-divisions$/);
  });

  it("dialog closes when the close button is pressed", () => {
    renderWithProviders(<DivisionMedal division="bronze" />);
    fireEvent.click(screen.getByTestId("division-medal-bronze"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Hay dos botones con aria-label='Cerrar' (el backdrop y el botón ×).
    // Usamos el del header (el último renderizado) que es el explícito.
    const closers = screen.getAllByRole("button", { name: /Cerrar/i });
    fireEvent.click(closers[closers.length - 1] as HTMLElement);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
