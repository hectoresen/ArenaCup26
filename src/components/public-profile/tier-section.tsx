import type { ProfileAchievementTierGroup } from "@/server/public-profile/types";
import { useTranslations } from "next-intl";
import { AchievementCard } from "./achievement-card";

type Props = {
  group: ProfileAchievementTierGroup;
  ownerUsername: string;
};

const TIER_COLOR: Record<ProfileAchievementTierGroup["tier"], string> = {
  common: "text-success",
  rare: "text-info",
  epic: "text-purple-400",
  legendary: "text-gold",
  mythic: "text-warm",
  goat: "text-silver",
};

/**
 * Sección de un tier dentro del acordeón. Cabecera con nombre del
 * tier + contador unlocked/total, y grid 2 columnas (1 en móvil) con
 * las cards.
 *
 * Orden interno: desbloqueados primero, bloqueados después. Dentro de
 * cada grupo se respeta el orden original del catálogo (ya viene
 * estable desde la query, evitamos re-sort por timestamp para no
 * mover de sitio los logros entre cargas).
 */
export function TierSection({ group, ownerUsername }: Props) {
  const t = useTranslations("publicProfile");
  const sortedItems = [...group.items].sort((a, b) => {
    if (a.unlocked === b.unlocked) return 0;
    return a.unlocked ? -1 : 1;
  });
  return (
    <section aria-label={t(`tier.${group.tier}`)} className="space-y-2.5">
      <header className="flex items-center justify-between">
        <h3
          className={`font-display text-[13px] uppercase tracking-[0.14em] ${TIER_COLOR[group.tier]}`}
        >
          {t(`tier.${group.tier}`)}
        </h3>
        <span className="text-[11px] font-extrabold tracking-wide text-muted">
          {group.unlocked} / {group.total}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-2 max-[460px]:grid-cols-1">
        {sortedItems.map((item) => (
          <AchievementCard
            key={item.definition.id}
            achievement={item}
            ownerUsername={ownerUsername}
          />
        ))}
      </div>
    </section>
  );
}
