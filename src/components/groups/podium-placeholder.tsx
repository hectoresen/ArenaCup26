import { useTranslations } from "next-intl";

type Place = 1 | 2 | 3;

const TONE: Record<Place, { container: string; border: string; badge: string; emoji: string }> = {
  1: {
    container: "bg-gradient-to-br from-[#1e1a08]/40 to-[#14120a]/40",
    border: "border-dashed border-gold/40",
    badge: "border border-gold/40 bg-gold/10 text-gold",
    emoji: "👑",
  },
  2: {
    container: "bg-gradient-to-br from-[#141e2a]/40 to-[#0e1620]/40",
    border: "border-dashed border-silver/35",
    badge: "border border-silver/40 bg-silver/10 text-silver",
    emoji: "🥈",
  },
  3: {
    container: "bg-gradient-to-br from-[#1a1008]/40 to-[#120e08]/40",
    border: "border-dashed border-bronze/35",
    badge: "border border-bronze/40 bg-bronze/10 text-bronze",
    emoji: "🥉",
  },
};

/**
 * Placeholder visual cuando una posición del podio del grupo no tiene
 * ocupante. Mantiene el mismo footprint que `<PodiumCard>` para que
 * el grid quede alineado, pero usa border dashed + opacity reducida +
 * un copy juguetón i18n.
 *
 * Animación sutil: el emoji "respira" con `blink` — opacity oscila
 * entre 1 y 0.25 cada 2s. `prefers-reduced-motion` ya la reduce.
 */
export function PodiumPlaceholder({ place }: { place: Place }) {
  const t = useTranslations("groups.ranking.podium");
  const tone = TONE[place];
  const labelKey = `place${place}` as const;
  const copyKey = `free${place}` as const;
  const label = t(labelKey);
  const copy = t(copyKey);
  return (
    <div
      aria-label={t("ariaFree", { place, copy })}
      className={`relative block overflow-hidden rounded-2xl border-[2.5px] px-2.5 pb-3.5 pt-3.5 text-center ${tone.container} ${tone.border} opacity-90`}
    >
      <span
        className={`absolute end-2 top-2 rounded-full px-1.5 py-0.5 font-display text-[10px] leading-[1.4] ${tone.badge}`}
      >
        {label}
      </span>
      <div
        className={`mx-auto mb-1.5 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-dashed border-white/15 bg-card-hover/40 text-2xl [animation:blink_2.4s_ease-in-out_infinite]`}
      >
        {tone.emoji}
      </div>
      <div className="mb-1 h-[20px]" aria-hidden="true" />
      <div className="mb-1.5 truncate text-[10px] font-extrabold leading-snug text-muted">
        {copy}
      </div>
      <span className="block font-display text-base leading-none text-muted [animation:blink_2.4s_ease-in-out_infinite]">
        —
      </span>
      <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted/70">
        {t("labelFree")}
      </div>
    </div>
  );
}
