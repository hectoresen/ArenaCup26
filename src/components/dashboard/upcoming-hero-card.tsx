import { useLocale, useTranslations } from "next-intl";
import { TeamFlag } from "@/components/common/team-flag";
import { formatMatchDate, formatMatchTime, type SupportedLocale } from "@/lib/format/date";
import { Link } from "@/i18n/navigation";
import type { PredictionView, UpcomingHeroView } from "@/server/dashboard/types";
import { basePointsForKind } from "@/server/predictions/rules";
import { POINTS } from "@/server/scoring/rules";

type Props = {
  next: UpcomingHeroView;
  /** Para tests: forzar el "now" usado en formatMatchDate. */
  now?: Date;
};

/**
 * Card "Próximo partido" — se muestra cuando no hay live ahora pero
 * sí hay un partido próximo. Click → detalle del partido.
 *
 * Si el usuario ya envió una predicción para ese partido, la muestra
 * resumida como chip verde. Si no, muestra un CTA "Predecir".
 */
export function UpcomingHeroCard({ next, now }: Props) {
  const t = useTranslations("dashboard.next");
  const locale = useLocale() as SupportedLocale;
  const date = formatMatchDate(next.kickoffAt, locale, now);
  const time = formatMatchTime(next.kickoffAt);

  return (
    <Link
      href={`/partidos/${next.matchId}` as never}
      aria-label={t("kickoffAt", { date, time })}
      className="block cursor-pointer rounded-2xl border-2 border-border bg-card px-4 py-4 no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[2px] hover:border-gold/30 hover:shadow-[0_8px_24px_rgba(245,200,66,0.1)] [animation:fadeUp_0.5s_ease_0.18s_forwards] opacity-0"
    >
      <div className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
        {t("kickoffAt", { date, time })}
      </div>
      <div className="flex items-center justify-center gap-3">
        <Team name={next.homeTeam.name} flag={next.homeTeam.flag ?? next.homeTeam.code} />
        <span className="font-display text-2xl text-muted">vs</span>
        <Team name={next.awayTeam.name} flag={next.awayTeam.flag ?? next.awayTeam.code} />
      </div>

      <PredictionRow prediction={next.prediction} home={next.homeTeam.name} away={next.awayTeam.name} />
    </Link>
  );
}

function Team({ name, flag }: { name: string; flag: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <TeamFlag flag={flag} name={name} size={28} className="text-2xl leading-none" />
      <span className="text-center text-xs font-extrabold text-foreground">{name}</span>
    </div>
  );
}

function PredictionRow({
  prediction,
  home,
  away,
}: {
  prediction: PredictionView | null;
  home: string;
  away: string;
}) {
  const t = useTranslations("dashboard.next");
  const tSum = useTranslations("predictions.summary");

  if (prediction === null) {
    return (
      <div className="mt-4 flex flex-col items-center gap-1.5">
        <span className="text-[12px] font-extrabold text-gold">{t("predictCta")} →</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
          {t("upToPoints", { points: POINTS.exact })}
        </span>
      </div>
    );
  }

  const potentialPoints = basePointsForKind(prediction.kind);

  const summary = (() => {
    switch (prediction.kind) {
      case "exact":
        return tSum("exact", {
          home,
          away,
          homeScore: prediction.predictedHomeScore ?? 0,
          awayScore: prediction.predictedAwayScore ?? 0,
        });
      case "simple":
        if (prediction.predictedWinner === "home") return tSum("teamWins", { team: home });
        if (prediction.predictedWinner === "away") return tSum("teamWins", { team: away });
        return tSum("draw");
      case "double-1x":
        return tSum("teamOrDraw", { team: home });
      case "double-x2":
        return tSum("teamOrDraw", { team: away });
      case "double-12":
        // Legacy: ya no se permite crear, pero datos viejos podrían existir.
        return `${home} / ${away}`;
    }
  })();

  return (
    <div className="mt-4 flex flex-col items-center gap-1 rounded-xl border-[1.5px] border-success/30 bg-success/10 px-3 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-success">
        ✓ {t("predictionSent")}
      </span>
      <span className="text-center text-[13px] font-extrabold text-foreground">{summary}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
        {t("ifCorrect", { points: potentialPoints })}
      </span>
    </div>
  );
}
