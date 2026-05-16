import { ACHIEVEMENT_CATALOG } from "@/server/achievements/catalog";
import type { ProfileAchievement } from "@/server/public-profile/types";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { describe, expect, it } from "vitest";
import { AchievementCard } from "./achievement-card";

function build(achievementId: string, unlocked: boolean): ProfileAchievement {
  const def = ACHIEVEMENT_CATALOG.find((d) => d.id === achievementId);
  if (!def) throw new Error(`no def: ${achievementId}`);
  return {
    definition: def,
    unlocked,
    unlockedAt: unlocked ? new Date() : null,
  };
}

describe("<AchievementCard>", () => {
  it("renders title and description (unlocked)", () => {
    renderWithProviders(
      <AchievementCard achievement={build("first-hit", true)} ownerUsername="carlos" />,
    );
    expect(
      screen.getByText(ACHIEVEMENT_CATALOG.find((d) => d.id === "first-hit")?.title ?? ""),
    ).toBeInTheDocument();
  });

  it("marks unlocked='true' on the article when unlocked", () => {
    const { container } = renderWithProviders(
      <AchievementCard achievement={build("first-hit", true)} ownerUsername="carlos" />,
    );
    expect(container.querySelector("[data-unlocked='true']")).not.toBeNull();
  });

  it("marks unlocked='false' and shows the lock glyph when locked", () => {
    const { container } = renderWithProviders(
      <AchievementCard achievement={build("the-goat", false)} ownerUsername="carlos" />,
    );
    expect(container.querySelector("[data-unlocked='false']")).not.toBeNull();
    // El estado bloqueado renderiza el sprite `#ach-lock` en lugar
    // del emoji 🔒 que se usaba antes del port del reference.
    expect(container.querySelector('use[href="#ach-lock"]')).not.toBeNull();
  });

  it("renders the share-chip ONLY when unlocked AND tier is legendary/mythic/goat", () => {
    // common unlocked → sin chip
    const c1 = renderWithProviders(
      <AchievementCard achievement={build("first-hit", true)} ownerUsername="carlos" />,
    );
    expect(c1.container.querySelector("a[href*='#ach-']")).toBeNull();
    c1.unmount();

    // legendary unlocked → con chip
    const c2 = renderWithProviders(
      <AchievementCard achievement={build("the-prophet", true)} ownerUsername="carlos" />,
    );
    expect(c2.container.querySelector("a[href*='#ach-the-prophet']")).not.toBeNull();
    c2.unmount();

    // legendary locked → sin chip (no se puede compartir lo que no tienes)
    const c3 = renderWithProviders(
      <AchievementCard achievement={build("the-prophet", false)} ownerUsername="carlos" />,
    );
    expect(c3.container.querySelector("a[href*='#ach-']")).toBeNull();
  });

  it("share-chip uses the owner username in the href", () => {
    const { container } = renderWithProviders(
      <AchievementCard achievement={build("the-goat", true)} ownerUsername="layla" />,
    );
    const chip = container.querySelector("a[href*='#ach-']");
    expect(chip?.getAttribute("href")).toBe("/u/layla#ach-the-goat");
  });

  it("attaches id='ach-<id>' to enable deep-link anchors", () => {
    const { container } = renderWithProviders(
      <AchievementCard achievement={build("first-hit", true)} ownerUsername="carlos" />,
    );
    expect(container.querySelector("#ach-first-hit")).not.toBeNull();
  });
});
