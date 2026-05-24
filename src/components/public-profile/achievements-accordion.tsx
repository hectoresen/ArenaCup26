import type { AchievementsGateStatus } from "@/server/achievements/gate";
import type { ProfileAchievements } from "@/server/public-profile/types";
import { useTranslations } from "next-intl";
import { AchievementsIconSprite } from "./achievement-sprite";
import { TierSection } from "./tier-section";

type Props = {
  achievements: ProfileAchievements;
  ownerUsername: string;
  /** Si `active`, mostramos un aviso "logros bloqueados hasta N partidos". */
  gate?: AchievementsGateStatus;
};

/**
 * Acordeón nativo `<details>`/`<summary>` con el catálogo de logros.
 *
 * Abierto por defecto: en el perfil queremos que los logros sean lo
 * primero que se vea sin que el user tenga que clicar. Se mantiene el
 * mecanismo de plegado para quien quiera ahorrar scroll.
 */
export function AchievementsAccordion({ achievements, ownerUsername, gate }: Props) {
  const t = useTranslations("publicProfile");
  const pct =
    achievements.totalCount > 0
      ? Math.round((achievements.unlockedCount / achievements.totalCount) * 100)
      : 0;

  return (
    <>
      {/* Sprite SVG con los 24 iconos + lock. Se monta una sola vez
          al cargar el acordeón. Sin esto, los `<use href="#ach-...">`
          de las cards renderizan vacíos. */}
      <AchievementsIconSprite />
      <details
        id="achievements"
        open
        className="mt-6 group rounded-2xl border-2 border-border bg-card open:border-gold/30 scroll-mt-20"
      >
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
          {gate?.active && (
            <div className="-mx-1 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[12px] font-bold text-amber-200">
              {t("gateBanner", {
                threshold: gate.threshold,
                finished: gate.finishedCount,
              })}
            </div>
          )}
          {achievements.groups.map((group) => (
            <TierSection key={group.tier} group={group} ownerUsername={ownerUsername} />
          ))}
        </div>
      </details>
    </>
  );
}
