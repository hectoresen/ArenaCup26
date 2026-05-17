import { isShareable } from "@/server/public-profile/transforms";
import type { ProfileAchievement } from "@/server/public-profile/types";
import { useTranslations } from "next-intl";
import { achSymbolHref } from "./achievement-sprite";

type Props = {
  achievement: ProfileAchievement;
  /** username del perfil; usado para construir el deep-link de share. */
  ownerUsername: string;
};

/**
 * Card de un logro individual. Port del diseño en
 * `docs/achievements-reference.html` (sección `.ach.common`, `.ach.rare`,
 * …):
 *
 *  - **Rarity badge** arriba a la derecha con color tier.
 *  - **Icon 36×36** bloque a la izquierda, sin chip — usa drop-shadow
 *    teñido por tier.
 *  - **Title** coloreado por tier con text-shadow en tier alto.
 *  - **Description** muted, 2 líneas máx.
 *  - **Unlocked check** SVG absolute bottom-right (no emoji).
 *  - **Accent strip** top-edge degradada según tier (refuerza la
 *    identidad cromática cuando hay muchas cards juntas).
 *  - Hover: lift -3px + drop-shadow (icono se queda quieto).
 *  - Estado `locked` → borde dashed en tier-color con opacity baja,
 *    greyscale parcial y opacity 0.55. Más legible que un fade plano
 *    y deja clarísimo que "está ahí pero todavía no es tuyo".
 *  - Share chip al hover SOLO en tier legendary/mythic/goat.
 */
export function AchievementCard({ achievement, ownerUsername }: Props) {
  const t = useTranslations("publicProfile");
  const { definition, unlocked } = achievement;
  const shareable = isShareable(achievement);

  return (
    <article
      id={`ach-${definition.id}`}
      data-tier={definition.tier}
      data-unlocked={unlocked ? "true" : "false"}
      aria-label={`${definition.title} — ${unlocked ? t("unlockedLabel") : t("lockedLabel")}`}
      className={`group relative overflow-hidden rounded-2xl border-2 px-4 pb-3.5 pt-6 transition-[transform,box-shadow] duration-200 ${
        unlocked
          ? `${tierBorder(definition.tier)} ${tierHoverShadow(definition.tier)} bg-card hover:-translate-y-[3px]`
          : `${tierBorderLocked(definition.tier)} pointer-events-none border-dashed bg-card opacity-[0.55] [filter:grayscale(0.45)]`
      }`}
    >
      {/* Accent strip top — refuerza la identidad de tier */}
      {unlocked && (
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-[2px] ${tierAccentStrip(definition.tier)}`}
        />
      )}

      {/* Rarity badge — top-right, color per tier */}
      <span
        className={`absolute end-2.5 top-2.5 inline-flex items-center rounded-full border-[1.5px] px-2 py-px text-[9px] font-black uppercase tracking-[0.1em] ${rarityBadgeClass(definition.tier)}`}
      >
        {t(`tier.${definition.tier}`)}
      </span>

      {/* Icon block — 36×36, no chip, color via currentColor. El icono
          se queda quieto al hover; el lift de la card ya da feedback
          suficiente sin marear con dos animaciones a la vez. */}
      <div
        aria-hidden="true"
        className="mb-2 block leading-none"
        style={unlocked ? { color: tierIconColor(definition.tier) } : undefined}
      >
        {unlocked ? (
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            className={tierIconFilter(definition.tier)}
          >
            <use href={achSymbolHref(definition.iconId)} />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 16 16" className="text-muted">
            <use href="#ach-lock" />
          </svg>
        )}
      </div>

      {/* Title + desc */}
      <div
        className={`mb-1 line-clamp-1 pe-12 font-display text-[15px] leading-[1.15] ${tierTitleClass(definition.tier)}`}
      >
        {definition.title}
      </div>
      <div className="line-clamp-2 text-[11px] font-bold leading-snug text-muted">
        {definition.description}
      </div>

      {/* Unlocked check — bottom-right, SVG (no emoji) */}
      {unlocked && (
        <span
          aria-hidden="true"
          className="absolute bottom-2.5 end-2.5"
          title={t("unlockedLabel")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <use href="#ach-unlocked" />
          </svg>
        </span>
      )}

      {/* Share chip — solo unlocked + tier alto, hover-revealed */}
      {shareable && (
        <a
          href={`/u/${ownerUsername}#ach-${definition.id}`}
          className={`mt-2 inline-flex items-center gap-1 rounded-md border-[1.5px] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] opacity-0 transition-opacity group-hover:opacity-100 ${shareChipClass(definition.tier)}`}
        >
          ↗ {t("shareLabel")}
        </a>
      )}
    </article>
  );
}

function tierBorder(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "common":
      return "border-success/25";
    case "rare":
      return "border-info/25";
    case "epic":
      return "border-purple-400/30";
    case "legendary":
      return "border-gold/35";
    case "mythic":
      return "border-warm/35";
    case "goat":
      return "border-silver/35";
  }
}

/**
 * Borde dashed con muy poca opacidad para el estado locked. Mantiene
 * la identidad de tier sin gritar — el contenido ya está fadeado.
 */
function tierBorderLocked(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "common":
      return "border-success/20";
    case "rare":
      return "border-info/20";
    case "epic":
      return "border-purple-400/20";
    case "legendary":
      return "border-gold/25";
    case "mythic":
      return "border-warm/25";
    case "goat":
      return "border-silver/25";
  }
}

/**
 * Franja superior de 2px con gradiente del color del tier. Solo se
 * pinta en cards unlocked. Refuerza la identidad cromática cuando
 * hay un grid de muchas cards mezcladas.
 */
function tierAccentStrip(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "common":
      return "bg-gradient-to-r from-transparent via-success/60 to-transparent";
    case "rare":
      return "bg-gradient-to-r from-transparent via-info/60 to-transparent";
    case "epic":
      return "bg-gradient-to-r from-transparent via-purple-400/70 to-transparent";
    case "legendary":
      return "bg-gradient-to-r from-transparent via-gold/80 to-transparent";
    case "mythic":
      return "bg-gradient-to-r from-transparent via-warm/80 to-transparent";
    case "goat":
      return "bg-gradient-to-r from-transparent via-silver/90 to-transparent";
  }
}

function tierHoverShadow(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "common":
      return "hover:shadow-[0_8px_24px_rgba(52,217,123,0.14)]";
    case "rare":
      return "hover:shadow-[0_8px_24px_rgba(79,195,247,0.15)]";
    case "epic":
      return "hover:shadow-[0_8px_28px_rgba(192,132,252,0.18)]";
    case "legendary":
      return "hover:shadow-[0_8px_36px_rgba(245,200,66,0.22)]";
    case "mythic":
      return "hover:shadow-[0_8px_36px_rgba(255,140,66,0.22)]";
    case "goat":
      return "hover:shadow-[0_10px_42px_rgba(168,216,255,0.25)]";
  }
}

function rarityBadgeClass(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "common":
      return "border-success/30 bg-success/[0.08] text-success";
    case "rare":
      return "border-info/30 bg-info/[0.08] text-info";
    case "epic":
      return "border-purple-400/30 bg-purple-400/[0.08] text-purple-400";
    case "legendary":
      return "border-gold/35 bg-gold/[0.08] text-gold";
    case "mythic":
      return "border-warm/35 bg-warm/[0.08] text-warm";
    case "goat":
      return "border-silver/35 bg-silver/[0.08] tracking-[0.2em] text-silver";
  }
}

/**
 * Color del trazo del icono SVG. Lo pasamos como `color` para que el
 * `currentColor` del sprite herede el matiz del tier. Valores
 * alineados con `docs/achievements-reference.html` (líneas 264-516).
 */
function tierIconColor(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "common":
      return "#34d97b";
    case "rare":
      return "#4fc3f7";
    case "epic":
      return "#c084fc";
    case "legendary":
      return "#f5c842";
    case "mythic":
      return "#ff8c42";
    case "goat":
      return "#a8d8ff";
  }
}

function tierIconFilter(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "common":
      return "[filter:drop-shadow(0_0_5px_rgba(52,217,123,0.3))]";
    case "rare":
      return "[filter:drop-shadow(0_0_5px_rgba(79,195,247,0.3))]";
    case "epic":
      return "[filter:drop-shadow(0_0_6px_rgba(192,132,252,0.4))]";
    case "legendary":
      return "[filter:drop-shadow(0_0_8px_rgba(245,200,66,0.35))]";
    case "mythic":
      return "[filter:drop-shadow(0_0_8px_rgba(255,140,66,0.35))]";
    case "goat":
      return "[filter:drop-shadow(0_0_10px_rgba(168,216,255,0.45))]";
  }
}

function tierTitleClass(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "common":
      return "text-[#a8ffd4]";
    case "rare":
      return "text-[#b8e8ff]";
    case "epic":
      return "text-[#e8d4ff]";
    case "legendary":
      return "text-gold [text-shadow:0_0_12px_rgba(245,200,66,0.35)]";
    case "mythic":
      return "text-[#ffd4a8] [text-shadow:0_0_12px_rgba(255,140,66,0.35)]";
    case "goat":
      return "text-silver [text-shadow:0_0_14px_rgba(168,216,255,0.5)]";
  }
}

function shareChipClass(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "legendary":
      return "border-gold/30 bg-gold/10 text-gold";
    case "mythic":
      return "border-warm/30 bg-warm/10 text-warm";
    case "goat":
      return "border-silver/30 bg-silver/10 text-silver";
    default:
      return "border-border bg-card text-muted";
  }
}
