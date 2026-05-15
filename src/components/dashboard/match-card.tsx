import { useLocale, useTranslations } from "next-intl";
import { LocalTime } from "@/components/common/local-time";
import { TeamFlag } from "@/components/common/team-flag";
import { formatMatchDate, type SupportedLocale } from "@/lib/format/date";
import { Link } from "@/i18n/navigation";
import { isMatchTBD } from "@/server/dashboard/transforms";
import type { PredictionView, UpcomingMatch } from "@/server/dashboard/types";

type Props = {
  match: UpcomingMatch;
  /** Para tests: forzar el "now" usado en formatMatchDate. */
  now?: Date;
};

/**
 * Card de la lista "Próximos partidos" en `/inicio`. Layout vertical
 * en tres bandas: header con fecha + chip de estado, cuerpo con grid
 * `equipo · VS · equipo`, y footer con CTA o resumen de la predicción.
 *
 * Variantes:
 *
 *  - **predicted** — badge verde "Enviada" en el header y resumen
 *    "Local · Editable" / "2-1 · Editable" en el footer.
 *  - **pending** — CTA "Predecir →" gold en el footer.
 *  - **kickoff-past** — chip "Cerrado" en el footer (defensa cliente
 *    mientras el sync mueve el status a `live`/`prediction-locked`).
 *  - **tbd** — `? vs ?` en gris con chip "Pendiente", no clickable.
 */
export function MatchCard({ match, now }: Props) {
  const t = useTranslations("dashboard.upcoming");
  const locale = useLocale() as SupportedLocale;
  const tbd = isMatchTBD(match);
  const date = formatMatchDate(match.kickoffAt, locale, now);

  if (tbd) {
    return (
      <article
        aria-disabled="true"
        aria-label={t("tbdLabel")}
        className="flex min-h-[124px] flex-col rounded-2xl border-2 border-border bg-card px-4 py-4 opacity-60 [filter:grayscale(0.5)]"
      >
        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
          <span>
            {date} · <LocalTime date={match.kickoffAt} />
          </span>
          <span className="rounded-full border-[1.5px] border-border bg-card-hover px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
            {t("tbdPending")}
          </span>
        </div>
        <div className="grid flex-1 grid-cols-[1fr_auto_1fr] content-center items-center gap-3 py-2">
          <span className="text-end font-display text-[17px] tracking-wider text-muted">?</span>
          <span className="text-center text-[13px] font-bold text-muted">{t("versus")}</span>
          <span className="text-start font-display text-[17px] tracking-wider text-muted">?</span>
        </div>
        <div className="text-[12px] font-bold text-muted">{t("tbdLabel")}</div>
      </article>
    );
  }

  // `isMatchTBD` ya garantiza que home/away no son null en esta rama,
  // pero TS no puede inferirlo. Comprobación explícita para que el
  // type narrowing funcione sin non-null assertions.
  if (!match.homeTeam || !match.awayTeam) return null;
  const home = match.homeTeam;
  const away = match.awayTeam;

  // Si el kickoff ya pasó pero el sync aún no movió el status a `live`
  // o `prediction-locked`, defendemos en el cliente: no mostramos el
  // botón "Predecir" y marcamos la card como "Cerrado". El submit del
  // server también rechazaría con `match_window_closed`, pero el UI
  // tiene que reflejarlo antes para no confundir al usuario.
  const nowMs = (now ?? new Date()).getTime();
  const kickoffPast = match.kickoffAt.getTime() <= nowMs;

  return (
    <Link
      href={`/partidos/${match.matchId}` as never}
      aria-label={`${home.name} vs ${away.name} — ${date}`}
      className="group flex min-h-[124px] cursor-pointer flex-col rounded-2xl border-2 border-border bg-card px-4 py-4 no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[2px] hover:border-gold/30 hover:shadow-[0_8px_24px_rgba(245,200,66,0.1)]"
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
        <span>
          <strong className="font-extrabold text-foreground">{date}</strong> ·{" "}
          <LocalTime date={match.kickoffAt} />
        </span>
        {match.prediction ? (
          <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-success">
            ✓ {t("predictBadge")}
          </span>
        ) : kickoffPast ? (
          <span className="rounded-full border-[1.5px] border-border bg-card-hover px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
            {t("closedLabel")}
          </span>
        ) : null}
      </div>

      <div className="grid flex-1 grid-cols-[1fr_auto_1fr] content-center items-center gap-3 py-2">
        <TeamSide team={home} side="home" />
        <span className="text-center text-[13px] font-bold text-muted">{t("versus")}</span>
        <TeamSide team={away} side="away" />
      </div>

      <FooterRow
        prediction={match.prediction}
        kickoffPast={kickoffPast}
        homeName={home.name}
        awayName={away.name}
      />
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
      className={`flex min-w-0 items-center gap-2 ${
        side === "away" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <TeamFlag
        flag={team.flag}
        name={team.name}
        size={26}
        fallback={team.code ?? "🏳️"}
        className="flex-shrink-0 rounded-sm"
      />
      <span className="min-w-0 truncate text-[15px] font-extrabold text-foreground">
        {team.name}
      </span>
    </div>
  );
}

function FooterRow({
  prediction,
  kickoffPast,
  homeName,
  awayName,
}: {
  prediction: PredictionView | null;
  kickoffPast: boolean;
  homeName: string;
  awayName: string;
}) {
  const t = useTranslations("dashboard.upcoming");
  if (prediction) {
    return (
      <div className="text-end text-[12px] font-bold text-muted">
        {formatPredictionShort(prediction)} · {t("predictEditable")}
      </div>
    );
  }
  if (kickoffPast) return null;
  return (
    <div className="text-end">
      <span
        aria-label={t("predictLabel", { home: homeName, away: awayName })}
        className="inline-flex items-center gap-1 text-[13px] font-extrabold text-gold transition-[gap] group-hover:gap-2"
      >
        {t("predictButton")} <span aria-hidden="true">→</span>
      </span>
    </div>
  );
}

/**
 * Texto compacto de una predicción para mostrar en la card.
 * - exact: "2-1"
 * - simple: "Local" / "Empate" / "Visitante" (no en eliminatoria)
 * - doubles: "Doble 1X" / "Doble X2" / "Doble 12"
 */
function formatPredictionShort(p: PredictionView): string {
  switch (p.kind) {
    case "exact":
      return `${p.predictedHomeScore ?? 0}-${p.predictedAwayScore ?? 0}`;
    case "simple":
      return p.predictedWinner === "home"
        ? "Local"
        : p.predictedWinner === "away"
          ? "Visitante"
          : "Empate";
    case "double-1x":
      return "Doble 1X";
    case "double-x2":
      return "Doble X2";
    case "double-12":
      return "Doble 12";
  }
}
