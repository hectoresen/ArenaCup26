import { type PointsLocale, formatPoints } from "@/lib/format/number";
import type { LeaderboardEntry, MiniLeaderboardView } from "@/server/dashboard/types";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  mini: MiniLeaderboardView;
};

/**
 * Top 5 + separador + fila del user. Si el user ya está en el top
 * (`mini.me === null`), el separador y la fila duplicada se omiten.
 */
export function MiniLeaderboard({ mini }: Props) {
  const t = useTranslations("dashboard.miniLeaderboard");

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {mini.top.map((entry) => (
          <Row key={entry.userId} entry={entry} isMe={false} />
        ))}
        {mini.me && (
          <>
            <li
              data-testid="mini-leaderboard-separator"
              aria-hidden="true"
              className="my-1 h-px list-none bg-border/60"
            />
            <Row entry={mini.me} isMe />
          </>
        )}
      </ul>
      <div className="mt-2 pr-1 text-right">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-extrabold text-gold transition-[gap] hover:gap-2"
        >
          {t("viewFullRanking")} <span aria-hidden="true">→</span>
        </button>
      </div>
    </>
  );
}

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const t = useTranslations("dashboard.miniLeaderboard");
  const locale = useLocale() as PointsLocale;
  const points = formatPoints(entry.points, locale);
  const label = isMe
    ? t("ariaMyRow", { rank: entry.rank, name: entry.name, points })
    : t("ariaRow", { rank: entry.rank, name: entry.name, points });

  return (
    <li
      aria-label={label}
      className={`grid grid-cols-[36px_1fr_auto] items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 transition-[background,transform] duration-200 hover:translate-x-[3px] ${
        isMe
          ? "border-gold/30 bg-gold/[0.07] shadow-[0_0_16px_rgba(245,200,66,0.08)]"
          : "border-transparent bg-card hover:bg-card-hover"
      }`}
    >
      <span className={`text-right font-display text-base ${isMe ? "text-gold" : "text-muted"}`}>
        #{entry.rank}
      </span>
      <div className="min-w-0">
        <span
          className={`block truncate text-[13px] font-extrabold ${
            isMe ? "text-gold" : "text-foreground"
          }`}
        >
          {entry.flag && (
            <span className="me-1 text-sm" role="img" aria-label={entry.name}>
              {entry.flag}
            </span>
          )}
          {entry.name}
          {isMe && (
            <span className="ms-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-gold/70">
              {t("youTag")}
            </span>
          )}
        </span>
      </div>
      <span
        className={`text-right font-display text-base ${isMe ? "text-gold" : "text-foreground"}`}
      >
        {points}
      </span>
    </li>
  );
}
