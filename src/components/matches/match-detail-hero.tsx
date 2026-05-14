import { LocalTime } from "@/components/common/local-time";
import { TeamFlag } from "@/components/common/team-flag";
import { type SupportedLocale, formatMatchDate } from "@/lib/format/date";
import type { MatchDetail } from "@/server/matches/types";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  match: MatchDetail;
  now?: Date;
};

/**
 * Hero del detalle de partido. Muestra:
 *  - Etapa (Grupo / Octavos / Cuartos / ...) y fecha-hora.
 *  - Equipos centrados con sus banderas en grande.
 *  - Marcador grande si hay (live/finished).
 *  - Detalle de prórroga / penaltis si aplica.
 *
 * El bloque para predecir (form) vive en otro componente (vendrá con
 * `add-prediction-flow`).
 */
export function MatchDetailHero({ match, now }: Props) {
  const t = useTranslations("matches");
  const locale = useLocale() as SupportedLocale;
  const home = match.homeTeam;
  const away = match.awayTeam;

  return (
    <article className="rounded-3xl border-2 border-border bg-card px-5 py-6 text-center">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border-[1.5px] border-gold/25 bg-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-gold">
        {t(`stages.${match.stage}`)}
      </div>
      <div className="mb-4 text-[11px] font-bold text-muted">
        {formatMatchDate(match.kickoffAt, locale, now)} · <LocalTime date={match.kickoffAt} />
      </div>

      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamCol team={home} />
        <ScoreCol match={match} />
        <TeamCol team={away} />
      </div>

      <ExtraScoreLine match={match} />

      {match.status === "live" && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-danger/35 bg-danger/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-danger">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-danger motion-safe:animate-[blink_1.4s_ease_infinite]"
          />
          {t("status.live")}
        </div>
      )}
    </article>
  );
}

function TeamCol({ team }: { team: MatchDetail["homeTeam"] }) {
  if (!team) {
    return <div className="text-3xl text-muted">?</div>;
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <TeamFlag flag={team.flag} name={team.name} size={48} className="text-[36px] leading-none" />
      <div className="text-sm font-extrabold text-foreground">{team.name}</div>
    </div>
  );
}

function ScoreCol({ match }: { match: MatchDetail }) {
  if (
    match.homeScore !== null &&
    match.awayScore !== null &&
    (match.status === "live" || match.status === "finished")
  ) {
    return (
      <div className="font-display text-[44px] leading-none tracking-wider text-foreground">
        {match.homeScore} <span className="text-muted">–</span> {match.awayScore}
      </div>
    );
  }
  return <div className="font-display text-2xl text-muted">vs</div>;
}

function ExtraScoreLine({ match }: { match: MatchDetail }) {
  const t = useTranslations("matches");
  if (
    match.homeScoreExtra === null ||
    match.awayScoreExtra === null ||
    match.status !== "finished"
  ) {
    return null;
  }
  return (
    <div className="mt-1 text-[11px] font-bold text-muted">
      {t("afterExtraTime")}: {match.homeScoreExtra} - {match.awayScoreExtra}
      {match.penaltyWinnerTeamId && (
        <span className="ms-2 inline-flex items-center gap-1 rounded-md border-[1.5px] border-info/30 bg-info/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-info">
          {t("penaltyWinner")}:{" "}
          {match.penaltyWinnerTeamId === match.homeTeam?.code
            ? match.homeTeam?.name
            : match.awayTeam?.name}
        </span>
      )}
    </div>
  );
}
