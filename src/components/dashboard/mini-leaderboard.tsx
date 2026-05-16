import { CountryFlag } from "@/components/common/country-flag";
import { Link } from "@/i18n/navigation";
import { type PointsLocale, formatPoints } from "@/lib/format/number";
import type {
  LeaderboardEntry,
  MiniLeaderboardData,
} from "@/server/dashboard/types";
import { useLocale, useTranslations } from "next-intl";

export type MiniTab = "global" | "amigos";

type Props = {
  mini: MiniLeaderboardData;
  /** Tab activa. Server-side desde el query param `?mini=amigos`. */
  active: MiniTab;
};

/**
 * Widget "Top del momento" con dos tabs:
 *  - **Global** (default): top 5 del leaderboard mundial.
 *  - **Amigos**: top 5 entre el grupo "yo + mis amigos aceptados".
 *    Solo se renderiza la tab si el user tiene ≥1 amigo (cuando
 *    `mini.friends.friendsCount === 0`, no se muestra la pestaña;
 *    se simplifica al single-view).
 *
 * Tabs server-side via search param `?mini=amigos` (back/forward del
 * navegador + URL compartible — mismo patrón que las tabs de
 * `/partidos`).
 */
export function MiniLeaderboard({ mini, active }: Props) {
  const t = useTranslations("dashboard.miniLeaderboard");
  const hasFriendsTab = mini.friends.friendsCount > 0;
  // Si la tab activa es "amigos" pero el user no tiene amigos, fallback a global.
  const effective: MiniTab = active === "amigos" && hasFriendsTab ? "amigos" : "global";
  const view = effective === "amigos" ? mini.friends : mini.global;

  return (
    <>
      {hasFriendsTab && <Tabs active={effective} />}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {view.top.length === 0 ? (
          <li className="rounded-xl border-2 border-dashed border-border bg-card/40 px-3 py-4 text-center text-[11px] font-bold text-muted">
            {effective === "amigos" ? t("emptyFriends") : t("emptyGlobal")}
          </li>
        ) : (
          view.top.map((entry) => (
            <Row key={entry.userId} entry={entry} isMe={false} />
          ))
        )}
        {view.me && (
          <>
            <li
              data-testid="mini-leaderboard-separator"
              aria-hidden="true"
              className="my-1 h-px list-none bg-border/60"
            />
            <Row entry={view.me} isMe />
          </>
        )}
      </ul>
      <div className="mt-2 pr-1 text-right">
        <Link
          href="/ranking"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-extrabold text-gold no-underline transition-[gap] hover:gap-2"
        >
          {t("viewFullRanking")} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  );
}

function Tabs({ active }: { active: MiniTab }) {
  const t = useTranslations("dashboard.miniLeaderboard");
  return (
    <nav
      aria-label={t("tabsAriaLabel")}
      className="mb-2 inline-flex items-center gap-1 rounded-full border-2 border-border bg-card p-1"
    >
      <TabLink to="global" active={active} label={t("tabGlobal")} />
      <TabLink to="amigos" active={active} label={t("tabFriends")} />
    </nav>
  );
}

function TabLink({
  to,
  active,
  label,
}: {
  to: MiniTab;
  active: MiniTab;
  label: string;
}) {
  const isActive = to === active;
  // "global" no añade param (es default); "amigos" sí.
  const href = to === "global" ? "/inicio" : "/inicio?mini=amigos";
  return (
    <Link
      href={href as never}
      aria-current={isActive ? "page" : undefined}
      // No resetar el scroll al cambiar de tab — el widget está abajo
      // del panel y el cambio es local; no queremos saltar arriba.
      scroll={false}
      className={`cursor-pointer rounded-full px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] no-underline transition-colors ${
        isActive ? "bg-gold text-black" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
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
          className={`flex min-w-0 items-center gap-1.5 text-[13px] font-extrabold ${
            isMe ? "text-gold" : "text-foreground"
          }`}
        >
          {entry.countryCode && (
            <CountryFlag
              code={entry.countryCode}
              name={entry.name}
              size={16}
              className="flex-shrink-0 rounded-sm"
            />
          )}
          <span className="truncate">{entry.name}</span>
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
