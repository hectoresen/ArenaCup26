import { useLocale, useTranslations } from "next-intl";
import { type SupportedLocale, formatMatchDate } from "@/lib/format/date";
import { groupMatchesByDay } from "@/server/matches/transforms";
import type { MatchListItem } from "@/server/matches/types";
import { EmptyMatchesState } from "./empty-matches-state";
import { MatchPanelCard } from "./match-panel-card";

type Props = {
  matches: MatchListItem[];
  /** Para tests: forzar el "now". */
  now?: Date;
};

/**
 * Listado de partidos agrupados por día, en orden cronológico ASC.
 * Cada grupo tiene un header con la fecha relativa ("Hoy", "Mañana",
 * "12 jun") y debajo las cards.
 *
 * Si no hay partidos, renderiza un estado vacío.
 */
export function MatchesList({ matches, now }: Props) {
  const t = useTranslations("matches");
  const locale = useLocale() as SupportedLocale;

  if (matches.length === 0) {
    return <EmptyMatchesState />;
  }

  const groups = groupMatchesByDay(matches);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.dayKey} aria-label={t("dayLabel")}>
          <header className="mb-2.5 flex items-center gap-2.5">
            <span className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
              {formatMatchDate(group.dayDate, locale, now)}
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
              {group.matches.length}{" "}
              {group.matches.length === 1 ? t("matchCount.one") : t("matchCount.many")}
            </span>
            <div className="h-px flex-1 bg-border" />
          </header>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {group.matches.map((match) => (
              <li key={match.matchId}>
                <MatchPanelCard match={match} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
