import { LocalTime } from "@/components/common/local-time";
import { TeamFlag } from "@/components/common/team-flag";
import { Link } from "@/i18n/navigation";
import { type SupportedLocale, formatMatchDate } from "@/lib/format/date";
import type { MatchListItem } from "@/server/matches/types";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  match: MatchListItem;
  /** Para tests: forzar el "now" usado en formatMatchDate. */
  now?: Date;
};

/**
 * Card del listado `/partidos`. Variante más completa que el
 * `MatchCard` del dashboard:
 *
 * - **live**: marcador en grande + badge "EN VIVO" pulsante.
 * - **finished**: marcador en grande + chip "Final" / "AET" / "PEN".
 * - **scheduled**: equipos + hora kickoff + badge "Enviada" o CTA
 *   "Predecir".
 * - **scheduled-tbd**: `? vs ?` con texto explicativo, sin click.
 * - **postponed**: cuerpo en gris con badge "Aplazado".
 * - **cancelled**: cuerpo en gris con badge "Cancelado".
 *
 * Toda la card es un Link a `/partidos/[id]` salvo el TBD.
 */
export function MatchPanelCard({ match, now }: Props) {
  const t = useTranslations("matches.card");
  const locale = useLocale() as SupportedLocale;

  const tbd = match.status === "scheduled-tbd" || !match.homeTeam || !match.awayTeam;

  if (tbd) {
    return (
      <article
        aria-disabled="true"
        aria-label={t("tbdLabel")}
        className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-4 opacity-60 [filter:grayscale(0.5)]"
      >
        <div className="flex-1">
          <div className="text-base font-bold tracking-wider text-muted">? vs ?</div>
          <div className="text-[11px] font-bold text-muted">
            {formatMatchDate(match.kickoffAt, locale, now)} ·{" "}
            <LocalTime date={match.kickoffAt} /> · {t("tbdLabel")}
          </div>
        </div>
        <span className="rounded-md border-[1.5px] border-border bg-white/[0.06] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-muted">
          {t("tbdPending")}
        </span>
      </article>
    );
  }

  const home = match.homeTeam;
  const away = match.awayTeam;
  if (!home || !away) return null;

  return (
    <Link
      href={`/partidos/${match.matchId}` as never}
      className={`group block cursor-pointer rounded-2xl border-2 px-4 py-4 no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(245,200,66,0.1)] ${
        match.status === "live"
          ? "border-danger/30 bg-card hover:border-danger/50"
          : match.status === "finished"
            ? "border-border bg-card opacity-90 hover:border-gold/30"
            : match.status === "postponed" || match.status === "cancelled"
              ? "border-border bg-card opacity-60"
              : "border-border bg-card hover:border-gold/30"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
        <span>
          {formatMatchDate(match.kickoffAt, locale, now)} · <LocalTime date={match.kickoffAt} />
        </span>
        <StatusChip status={match.status} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSide team={home} side="home" />
        <ScoreOrVs match={match} />
        <TeamSide team={away} side="away" />
      </div>

      <FooterRow match={match} />
    </Link>
  );
}

function TeamSide({
  team,
  side,
}: {
  team: { name: string; flag: string | null; code: string | null };
  side: "home" | "away";
}) {
  return (
    <div
      className={`flex items-center gap-2 ${side === "away" ? "flex-row-reverse text-right" : ""}`}
    >
      <TeamFlag
        flag={team.flag}
        name={team.name}
        size={28}
        className="text-2xl leading-none"
      />
      <div className="min-w-0 truncate text-sm font-extrabold text-foreground">{team.name}</div>
    </div>
  );
}

function ScoreOrVs({ match }: { match: MatchListItem }) {
  if (
    match.homeScore !== null &&
    match.awayScore !== null &&
    (match.status === "live" || match.status === "finished")
  ) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-center font-display text-2xl leading-none tracking-wider text-foreground">
          {match.homeScore} <span className="text-muted">–</span> {match.awayScore}
        </div>
        {/* Reloj del partido — solo cuando live y el provider ha
            reportado un minuto válido. En finished no aporta valor;
            el badge "Final" ya lo dice. */}
        {match.status === "live" && match.minute !== null && (
          <div className="text-[10px] font-black tracking-[0.06em] text-danger">
            {match.minute}&apos;
          </div>
        )}
      </div>
    );
  }
  return <div className="text-center text-xs font-bold text-muted">vs</div>;
}

function StatusChip({ status }: { status: MatchListItem["status"] }) {
  const t = useTranslations("matches.status");
  switch (status) {
    case "live":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-danger/35 bg-danger/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-danger">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-danger motion-safe:animate-[blink_1.4s_ease_infinite]"
          />
          {t("live")}
        </span>
      );
    case "finished":
      return (
        <span className="rounded-full border-[1.5px] border-border bg-card-hover px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
          {t("finished")}
        </span>
      );
    case "postponed":
      return (
        <span className="rounded-full border-[1.5px] border-warm/30 bg-warm/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-warm">
          {t("postponed")}
        </span>
      );
    case "cancelled":
      return (
        <span className="rounded-full border-[1.5px] border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-danger">
          {t("cancelled")}
        </span>
      );
    case "prediction-locked":
      return (
        <span className="rounded-full border-[1.5px] border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-info">
          {t("predictionLocked")}
        </span>
      );
    default:
      return null;
  }
}

function FooterRow({ match }: { match: MatchListItem }) {
  const t = useTranslations("matches.card");
  if (match.status === "scheduled" && !match.prediction) {
    return (
      <div className="mt-3 text-end">
        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-gold transition-[gap] group-hover:gap-2">
          {t("predict")} <span aria-hidden="true">→</span>
        </span>
      </div>
    );
  }
  // Live/finished sin predicción: feedback explícito al user — antes
  // el footer quedaba vacío y no era obvio si predijo o no.
  if (
    !match.prediction &&
    (match.status === "live" || match.status === "finished")
  ) {
    return (
      <div className="mt-3 text-end">
        <span className="inline-flex items-center gap-1 rounded-md border-[1.5px] border-border bg-card-hover px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-muted">
          {t("noPredictionShort")}
        </span>
      </div>
    );
  }
  if (match.prediction) {
    return (
      <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-muted">
        <span className="inline-flex items-center gap-1 rounded-md border-[1.5px] border-success/30 bg-success/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-success">
          ✓ {t("predictionSent")}
        </span>
      </div>
    );
  }
  return null;
}
