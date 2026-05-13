import { isShareable } from "@/server/public-profile/transforms";
import type { ProfileAchievement } from "@/server/public-profile/types";
import { useTranslations } from "next-intl";

type Props = {
  achievement: ProfileAchievement;
  /** username del perfil; usado para construir el deep-link de share. */
  ownerUsername: string;
};

/**
 * Card de un logro individual. Dos variantes visuales:
 *
 * - **unlocked**: color por tier, icono real, check verde, opcional
 *   share-chip al hover si el tier es legendary/mythic/goat.
 * - **locked**: greyscale + icono lock + descripción visible (para
 *   que el visitante sepa qué hay que lograr).
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
      className={`group relative overflow-hidden rounded-2xl border-2 px-3.5 py-3.5 transition-transform ${
        unlocked
          ? `${tierBorder(definition.tier)} bg-card hover:-translate-y-[2px]`
          : "border-border bg-card/60 opacity-60 [filter:grayscale(0.7)]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-base ${
            unlocked ? `${tierIconBg(definition.tier)}` : "border border-border bg-white/[0.04]"
          }`}
        >
          {unlocked ? definition.iconId.charAt(definition.iconId.length - 1) : "🔒"}
        </span>
        {unlocked && (
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success/20 text-[10px] text-success"
            title={t("unlockedLabel")}
          >
            ✓
          </span>
        )}
      </div>
      <div className="mb-0.5 truncate text-[13px] font-extrabold text-foreground">
        {definition.title}
      </div>
      <div className="line-clamp-2 text-[11px] font-bold leading-snug text-muted">
        {definition.description}
      </div>

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
      return "border-success/30";
    case "rare":
      return "border-info/30";
    case "epic":
      return "border-purple-400/30";
    case "legendary":
      return "border-gold/30";
    case "mythic":
      return "border-warm/30";
    case "goat":
      return "border-silver/30";
  }
}

function tierIconBg(tier: ProfileAchievement["definition"]["tier"]): string {
  switch (tier) {
    case "common":
      return "bg-success/15";
    case "rare":
      return "bg-info/15";
    case "epic":
      return "bg-purple-400/15";
    case "legendary":
      return "bg-gold/15";
    case "mythic":
      return "bg-warm/15";
    case "goat":
      return "bg-silver/15";
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
