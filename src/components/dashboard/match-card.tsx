import { type SupportedLocale, formatMatchDate, formatMatchTime } from "@/lib/format/date";
import { isMatchTBD } from "@/server/dashboard/transforms";
import type { PredictionView, UpcomingMatch } from "@/server/dashboard/types";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  match: UpcomingMatch;
  /** Para tests: forzar el "now" usado en formatMatchDate. */
  now?: Date;
};

/**
 * Card de la lista "Próximos partidos" con tres variantes:
 *
 * - **predicted** — el user ya envió predicción. Badge verde
 *   "Enviada" + literal "<resultado> · Editable".
 * - **pending** — partido programado sin predicción del user.
 *   Botón gold "Predecir".
 * - **tbd** — partido cuyos teams aún no se conocen (semifinal sin
 *   bracket). Gris, no clickable.
 */
export function MatchCard({ match, now }: Props) {
  const t = useTranslations("dashboard.upcoming");
  const locale = useLocale() as SupportedLocale;
  const tbd = isMatchTBD(match);
  const date = formatMatchDate(match.kickoffAt, locale, now);
  const time = formatMatchTime(match.kickoffAt);

  if (tbd) {
    return (
      <article
        // biome-ignore lint/a11y/useSemanticElements: el `<article>` puede estar dentro de un `<ul>/<li>` o aislado en otros contextos (modal, hero); usamos role para que ambos casos lean bien.
        role="listitem"
        aria-disabled="true"
        aria-label={t("tbdLabel")}
        className="flex cursor-not-allowed items-center gap-3.5 rounded-[14px] border-2 border-border bg-card px-4 py-3.5 opacity-45 [filter:grayscale(0.65)]"
      >
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold tracking-[2px] text-muted">{t("tbdRow")}</div>
          <div className="text-[11px] font-bold text-muted">
            {date} · {time} h · {t("tbdLabel")}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="inline-flex items-center rounded-lg border-[1.5px] border-border bg-white/[0.06] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-muted">
            {t("tbdPending")}
          </span>
        </div>
      </article>
    );
  }

  // `isMatchTBD` ya garantiza que home/away no son null en esta rama,
  // pero TS no puede inferirlo. Comprobación explícita para que el
  // type narrowing funcione sin non-null assertions.
  if (!match.homeTeam || !match.awayTeam) return null;
  const home = match.homeTeam;
  const away = match.awayTeam;

  return (
    <article
      // biome-ignore lint/a11y/useSemanticElements: ver nota arriba; el role permite usar este card también fuera de un `<ul>`.
      role="listitem"
      aria-label={`${home.name} vs ${away.name} — ${date} ${time}`}
      className="group flex cursor-pointer items-center gap-3.5 rounded-[14px] border-2 border-border bg-card px-4 py-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-[3px] hover:border-gold/30"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold text-foreground">
          <span aria-label={home.name}>{home.flag ?? home.code}</span> {home.name}
          <span className="mx-1.5 font-semibold text-muted">{t("versus")}</span>
          <span aria-label={away.name}>{away.flag ?? away.code}</span> {away.name}
        </div>
        <div className="text-[11px] font-bold text-muted">
          <strong className="text-foreground">{date}</strong> · {time} h
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        {match.prediction ? (
          <PredictedTrailing prediction={match.prediction} />
        ) : (
          <button
            type="button"
            aria-label={t("predictLabel", { home: home.name, away: away.name })}
            className="rounded-[10px] border-2 border-gold/40 bg-transparent px-4 py-1.5 text-[13px] font-extrabold text-gold transition-colors hover:border-gold hover:bg-gold/10"
          >
            {t("predictButton")}
          </button>
        )}
      </div>
    </article>
  );
}

function PredictedTrailing({ prediction }: { prediction: PredictionView }) {
  const t = useTranslations("dashboard.upcoming");
  const label = formatPredictionShort(prediction);
  return (
    <>
      <div className="mb-1 inline-flex items-center gap-1 rounded-lg border-[1.5px] border-success/30 bg-success/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-success">
        ✓ {t("predictBadge")}
      </div>
      <div className="text-[11px] font-bold text-muted">
        {label} · {t("predictEditable")}
      </div>
    </>
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
