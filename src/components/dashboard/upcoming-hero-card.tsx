import { type SupportedLocale, formatMatchDate, formatMatchTime } from "@/lib/format/date";
import type { UpcomingHeroView } from "@/server/dashboard/types";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  next: UpcomingHeroView;
  /** Para tests: forzar el "now" usado en formatMatchDate. */
  now?: Date;
};

/**
 * Card "Próximo partido" — se muestra cuando no hay live ahora pero
 * sí hay un partido próximo. Layout más sobrio que la live (sin
 * glow), enfocado en informar del kickoff.
 */
export function UpcomingHeroCard({ next, now }: Props) {
  const t = useTranslations("dashboard.next");
  const locale = useLocale() as SupportedLocale;
  const date = formatMatchDate(next.kickoffAt, locale, now);
  const time = formatMatchTime(next.kickoffAt);

  return (
    <article
      aria-label={t("kickoffAt", { date, time })}
      className="rounded-2xl border-2 border-border bg-card px-4 py-4 [animation:fadeUp_0.5s_ease_0.18s_forwards] opacity-0"
    >
      <div className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
        {t("kickoffAt", { date, time })}
      </div>
      <div className="flex items-center justify-center gap-3">
        <Team name={next.homeTeam.name} flag={next.homeTeam.flag ?? next.homeTeam.code} />
        <span className="font-display text-2xl text-muted">vs</span>
        <Team name={next.awayTeam.name} flag={next.awayTeam.flag ?? next.awayTeam.code} />
      </div>
    </article>
  );
}

function Team({ name, flag }: { name: string; flag: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-2xl leading-none" role="img" aria-label={name}>
        {flag ?? "🏳️"}
      </span>
      <span className="text-center text-xs font-extrabold text-foreground">{name}</span>
    </div>
  );
}
