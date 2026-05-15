import { LocalTime } from "@/components/common/local-time";
import { TeamFlag } from "@/components/common/team-flag";
import { formatMatchDate, type SupportedLocale } from "@/lib/format/date";
import { Link } from "@/i18n/navigation";
import type { MatchListItem } from "@/server/matches/types";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  match: MatchListItem;
  /** Para tests: forzar el "now". */
  now?: Date;
};

/**
 * Card compacta para la vista Bracket. Más densa que `MatchPanelCard`
 * porque las eliminatorias se muestran en grid 2-cols. Tres variantes:
 *
 *  - **finished/live**: marcador grande arriba, fecha pequeña abajo.
 *  - **scheduled con prediction**: badge "Enviada" + resumen corto.
 *  - **scheduled sin prediction**: chip "Predecir →" gold.
 *  - **tbd**: equipos null → `?` a cada lado, sin click.
 */
export function BracketCard({ match, now }: Props) {
  const t = useTranslations("matches.card");
  const tStatus = useTranslations("matches.status");
  const locale = useLocale() as SupportedLocale;

  const home = match.homeTeam;
  const away = match.awayTeam;
  const tbd = match.status === "scheduled-tbd" || !home || !away;
  const date = formatMatchDate(match.kickoffAt, locale, now);
  const hasScore =
    match.homeScore !== null &&
    match.awayScore !== null &&
    (match.status === "live" || match.status === "finished");

  if (tbd) {
    return (
      <article
        aria-disabled="true"
        aria-label={t("tbdLabel")}
        className="flex min-h-[96px] flex-col rounded-xl border-2 border-border bg-card px-3 py-3 opacity-60 [filter:grayscale(0.5)]"
      >
        <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
          {date} · <LocalTime date={match.kickoffAt} />
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 py-1">
          <span className="font-display text-base tracking-wider text-muted">?</span>
          <span className="text-[10px] font-bold text-muted">{t("versus")}</span>
          <span className="font-display text-base tracking-wider text-muted">?</span>
        </div>
        <div className="text-[10px] font-bold text-muted">{t("tbdLabel")}</div>
      </article>
    );
  }

  if (!home || !away) return null;

  return (
    <Link
      href={`/partidos/${match.matchId}` as never}
      aria-label={`${home.name} vs ${away.name} — ${date}`}
      className={`group flex min-h-[96px] cursor-pointer flex-col rounded-xl border-2 px-3 py-3 no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[2px] hover:shadow-[0_6px_18px_rgba(245,200,66,0.1)] ${
        match.status === "live"
          ? "border-danger/30 bg-card hover:border-danger/50"
          : match.status === "finished"
            ? "border-border bg-card opacity-90 hover:border-gold/30"
            : "border-border bg-card hover:border-gold/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
        <span>
          {date} · <LocalTime date={match.kickoffAt} />
        </span>
        {match.status === "live" && (
          <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-danger/35 bg-danger/15 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] text-danger">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-danger motion-safe:animate-[blink_1.4s_ease_infinite]"
            />
            {tStatus("live")}
          </span>
        )}
      </div>

      <div className="flex flex-1 items-center py-1">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamLine team={home} side="home" />
          <ScoreOrVs match={match} hasScore={hasScore} />
          <TeamLine team={away} side="away" />
        </div>
      </div>

      <Footer match={match} />
    </Link>
  );
}

function TeamLine({
  team,
  side,
}: {
  team: { name: string; flag: string | null; code: string | null };
  side: "home" | "away";
}) {
  // Bracket cards son estrechas (grid 2-cols del bracket). Usamos
  // código FIFA (3-letter) como label visible cuando hay sitio justo,
  // y mostramos nombre completo solo si cabe. Tooltip via title.
  const label = team.code ?? team.name;
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 ${
        side === "away" ? "flex-row-reverse text-right" : ""
      }`}
      title={team.name}
    >
      <TeamFlag
        flag={team.flag}
        name={team.name}
        size={20}
        fallback={team.code ?? "🏳️"}
        className="flex-shrink-0 rounded-sm"
      />
      <span className="min-w-0 truncate text-[12px] font-extrabold text-foreground">{label}</span>
    </div>
  );
}

function ScoreOrVs({ match, hasScore }: { match: MatchListItem; hasScore: boolean }) {
  const t = useTranslations("matches.card");
  if (hasScore) {
    return (
      <div className="text-center font-display text-base leading-none tracking-wider text-foreground">
        {match.homeScore} <span className="text-muted">–</span> {match.awayScore}
      </div>
    );
  }
  return <span className="text-center text-[10px] font-bold text-muted">{t("versus")}</span>;
}

function Footer({ match }: { match: MatchListItem }) {
  const t = useTranslations("matches.card");
  if (match.prediction) {
    return (
      <div className="inline-flex items-center gap-1 self-end rounded-md border-[1.5px] border-success/30 bg-success/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.1em] text-success">
        ✓ {t("predictionSent")}
      </div>
    );
  }
  if (match.status === "scheduled") {
    return (
      <div className="text-end">
        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-gold transition-[gap] group-hover:gap-2">
          {t("predict")} <span aria-hidden="true">→</span>
        </span>
      </div>
    );
  }
  return null;
}
