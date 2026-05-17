import { buildProfileAchievements } from "@/server/public-profile/transforms";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { AchievementsAccordion } from "./achievements-accordion";

describe("<AchievementsAccordion>", () => {
  it("renders the summary open by default (zero unlocked)", () => {
    const achievements = buildProfileAchievements(new Map());
    renderWithProviders(
      <AchievementsAccordion achievements={achievements} ownerUsername="carlos" />,
    );
    // El summary muestra "0 de 24"
    expect(screen.getByText(/0 de 24/)).toBeInTheDocument();
    // El `<details>` viene con atributo `open` para que el catálogo
    // sea lo primero que se ve sin clic.
    const details = screen.getByText(/0 de 24/).closest("details");
    expect(details?.hasAttribute("open")).toBe(true);
  });

  it("renders all 6 tier sections inside the body", () => {
    const achievements = buildProfileAchievements(new Map());
    const { container } = renderWithProviders(
      <AchievementsAccordion achievements={achievements} ownerUsername="carlos" />,
    );
    // Aunque el `<details>` esté cerrado, el body sí está en el DOM
    // (es el navegador quien lo oculta visualmente).
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBe(6);
  });

  it("renders all 24 achievement cards in the body", () => {
    const achievements = buildProfileAchievements(new Map());
    const { container } = renderWithProviders(
      <AchievementsAccordion achievements={achievements} ownerUsername="carlos" />,
    );
    const cards = container.querySelectorAll("[data-tier]");
    expect(cards.length).toBe(24);
  });

  it("computes progress percentage from unlocked / total", () => {
    const unlocked = new Map([
      ["first-hit", new Date()],
      ["good-eye", new Date()],
      ["five-of-five", new Date()],
    ]);
    const achievements = buildProfileAchievements(unlocked);
    const { container } = renderWithProviders(
      <AchievementsAccordion achievements={achievements} ownerUsername="carlos" />,
    );
    // 3/24 ≈ 13%
    const bar = container.querySelector('[style*="width"]') as HTMLElement | null;
    expect(bar?.style.width).toMatch(/^\d+%$/);
  });
});
