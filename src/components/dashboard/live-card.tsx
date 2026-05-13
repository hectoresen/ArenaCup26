import type { LiveMatchView } from "@/server/dashboard/types";
import { useTranslations } from "next-intl";

type Props = {
  live: LiveMatchView;
};

/**
 * Card del partido en vivo. Marcador grande + minuto + bloque con tu
 * predicción. Los puntos provisionales **no** se calculan en este
 * round porque el snapshot del provider no expone goles parciales
 * todavía (`add-live-scoring`); en su lugar mostramos el literal
 * "Se calcula al final del partido" para gestionar expectativa.
 */
export function LiveCard({ live }: Props) {
  const t = useTranslations("dashboard.live");

  const ariaLabel = t("ariaLive", {
    home: live.homeTeam.name,
    homeScore: live.homeScore,
    awayScore: live.awayScore,
    away: live.awayTeam.name,
    minute: live.minute ?? "-",
  });

  return (
    <article
      aria-label={ariaLabel}
      className="relative overflow-hidden rounded-2xl border-2 border-danger/30 bg-card px-4 py-4 [animation:fadeUp_0.5s_ease_0.18s_forwards] opacity-0"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(255,77,109,0.065)_0%,transparent_70%)]"
      />

      <div
        // biome-ignore lint/a11y/useSemanticElements: el badge "EN VIVO" no es contenido principal; usamos role=status para que screen readers anuncien cambios.
        role="status"
        aria-live="polite"
        className="mb-3.5 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-danger/35 bg-danger/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-danger"
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-danger motion-safe:animate-[blink_1.4s_ease_infinite]"
        />
        {t("badge")}
      </div>

      <div className="mb-1.5 flex items-center justify-center gap-3">
        <TeamColumn name={live.homeTeam.name} flag={live.homeTeam.flag ?? live.homeTeam.code} />
        <div className="flex flex-shrink-0 flex-col items-center">
          <span className="font-display text-4xl leading-none tracking-[2px] text-foreground">
            {live.homeScore} — {live.awayScore}
          </span>
          {live.minute !== null && (
            <span className="mt-1 text-[11px] font-extrabold tracking-[0.06em] text-danger">
              {t("minute", { minute: live.minute })}
            </span>
          )}
        </div>
        <TeamColumn name={live.awayTeam.name} flag={live.awayTeam.flag ?? live.awayTeam.code} />
      </div>

      {live.prediction ? (
        <PredictionBlock
          home={live.homeTeam.name}
          away={live.awayTeam.name}
          prediction={live.prediction}
        />
      ) : (
        <div className="mt-3.5 rounded-xl border-[1.5px] border-border bg-white/[0.04] px-3.5 py-3 text-center text-[12px] font-bold text-muted">
          {t("noPrediction")}
        </div>
      )}
    </article>
  );
}

function TeamColumn({ name, flag }: { name: string; flag: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-2xl leading-none" role="img" aria-label={name}>
        {flag ?? "🏳️"}
      </span>
      <span className="text-center text-xs font-extrabold text-foreground">{name}</span>
    </div>
  );
}

function PredictionBlock({
  home,
  away,
  prediction,
}: {
  home: string;
  away: string;
  prediction: NonNullable<LiveMatchView["prediction"]>;
}) {
  const t = useTranslations("dashboard.live");
  const label =
    prediction.kind === "exact"
      ? `${home} ${prediction.predictedHomeScore ?? 0} – ${prediction.predictedAwayScore ?? 0} ${away}`
      : prediction.predictedWinner === "home"
        ? `${home}`
        : prediction.predictedWinner === "away"
          ? `${away}`
          : "—";

  return (
    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border-[1.5px] border-success/20 bg-success/[0.06] px-3.5 py-3">
      <div>
        <div className="mb-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-muted">
          {t("yourPrediction")}
        </div>
        <div className="font-display text-base text-foreground">{label}</div>
      </div>
      <div className="text-right">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-muted">
          {t("computedAtEnd")}
        </span>
        <div>
          <span
            aria-label={t("provisional")}
            className="mt-0.5 inline-flex items-center gap-1 rounded-md border-[1.5px] border-info/30 bg-info/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-info"
          >
            {t("provisional")}
          </span>
        </div>
      </div>
    </div>
  );
}
