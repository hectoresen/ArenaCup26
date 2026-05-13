import type { ProfileAchievements } from "@/server/public-profile/types";
import { useTranslations } from "next-intl";
import { TierSection } from "./tier-section";

type Props = {
  achievements: ProfileAchievements;
  ownerUsername: string;
};

/**
 * Acordeón nativo `<details>`/`<summary>` con el catálogo de logros.
 *
 * Cerrado por defecto (decisión `docs/public-profile.md` 2026-05-07).
 * No usa JS para abrir/cerrar — el navegador lo gestiona y el SSR
 * sirve el estado cerrado sin coste.
 */
export function AchievementsAccordion({ achievements, ownerUsername }: Props) {
  const t = useTranslations("publicProfile");
  const pct =
    achievements.totalCount > 0
      ? Math.round((achievements.unlockedCount / achievements.totalCount) * 100)
      : 0;

  return (
    <details className="mt-6 group rounded-2xl border-2 border-border bg-card open:border-gold/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 transition-colors hover:bg-card-hover">
        <div className="flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-display text-[14px] uppercase tracking-[0.1em] text-gold">
              {t("accordionLabel")}
            </span>
            <span className="text-[11px] font-extrabold text-muted">
              {t("unlockedCount", {
                unlocked: achievements.unlockedCount,
                total: achievements.totalCount,
              })}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              aria-hidden="true"
              className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span
          aria-hidden="true"
          className="font-display text-base text-muted transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>

      <div className="space-y-6 border-t border-border px-4 py-5">
        {achievements.groups.map((group) => (
          <TierSection key={group.tier} group={group} ownerUsername={ownerUsername} />
        ))}
      </div>
    </details>
  );
}
