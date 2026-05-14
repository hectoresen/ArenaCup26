import { useLocale, useTranslations } from "next-intl";
import { LocalTime } from "@/components/common/local-time";
import { TeamFlag } from "@/components/common/team-flag";
import { Link } from "@/i18n/navigation";
import { type SupportedLocale, formatMatchDate } from "@/lib/format/date";
import type { HistoryEntry } from "@/server/history/types";

type Props = {
  entry: HistoryEntry;
  now?: Date;
};

/**
 * Card de una predicción pasada con:
 *  - Equipos + marcador real (si el partido terminó).
 *  - Etiqueta de tu predicción.
 *  - Pill con puntos ganados (verde si +N, rojo si 0, gris si "Pendiente").
 *  - Click → detalle del partido.
 */
export function HistoryEntryCard({ entry, now }: Props) {
  const t = useTranslations("history");
  const locale = useLocale() as SupportedLocale;
  const date = formatMatchDate(entry.kickoffAt, locale, now);

  const matchEnded = entry.status === "finished";
  const showScore =
    matchEnded || entry.status === "live"
      ? entry.homeScore !== null && entry.awayScore !== null
      : false;

  return (
    <Link
      href={`/partidos/${entry.matchId}` as never}
      className="group block cursor-pointer rounded-2xl border-2 border-border bg-card px-4 py-3.5 no-underline transition-[transform,border-color] duration-200 hover:-translate-y-[2px] hover:border-gold/30"
      aria-label={`${entry.homeTeam.name} vs ${entry.awayTeam.name} — ${date}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
        <span>
          <strong className="text-foreground">{date}</strong> ·{" "}
          <LocalTime date={entry.kickoffAt} />
        </span>
        <StatusBadge status={entry.status} />
      </div>

      <div className="flex items-center gap-3">
        <TeamFlag
          flag={entry.homeTeam.flag}
          name={entry.homeTeam.name}
          size={22}
          fallback={entry.homeTeam.code ?? "🏳️"}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-foreground">
          {entry.homeTeam.name}
        </span>

        {showScore ? (
          <span className="font-display text-base tabular-nums text-foreground">
            {entry.homeScore} <span className="text-muted">–</span> {entry.awayScore}
          </span>
        ) : (
          <span className="font-display text-base text-muted">vs</span>
        )}

        <span className="min-w-0 flex-1 truncate text-end text-sm font-extrabold text-foreground">
          {entry.awayTeam.name}
        </span>
        <TeamFlag
          flag={entry.awayTeam.flag}
          name={entry.awayTeam.name}
          size={22}
          fallback={entry.awayTeam.code ?? "🏳️"}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="text-[11px] font-bold text-muted">
          <span className="text-foreground">{t("yourPrediction")}: </span>
          <span className="text-foreground/90">
            {formatPredictionLabel(entry.prediction, t)}
          </span>
        </span>
        <PointsBadge points={entry.pointsEarned} t={t} />
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: HistoryEntry["status"] }) {
  const t = useTranslations("history.status");
  if (status === "finished") {
    return (
      <span className="rounded-full border-[1.5px] border-success/30 bg-success/10 px-2 py-px text-[9px] font-black text-success">
        {t("finished")}
      </span>
    );
  }
  if (status === "live") {
    return (
      <span className="rounded-full border-[1.5px] border-danger/35 bg-danger/15 px-2 py-px text-[9px] font-black text-danger">
        {t("live")}
      </span>
    );
  }
  if (status === "postponed") {
    return (
      <span className="rounded-full border-[1.5px] border-border bg-white/[0.06] px-2 py-px text-[9px] font-black text-muted">
        {t("postponed")}
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="rounded-full border-[1.5px] border-border bg-white/[0.06] px-2 py-px text-[9px] font-black text-muted">
        {t("cancelled")}
      </span>
    );
  }
  return (
    <span className="rounded-full border-[1.5px] border-gold/25 bg-gold/[0.06] px-2 py-px text-[9px] font-black text-gold/90">
      {t("scheduled")}
    </span>
  );
}

function PointsBadge({
  points,
  t,
}: {
  points: number | null;
  t: ReturnType<typeof useTranslations<"history">>;
}) {
  if (points === null) {
    return (
      <span className="rounded-lg border-[1.5px] border-border bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-muted">
        {t("pending")}
      </span>
    );
  }
  if (points <= 0) {
    return (
      <span className="rounded-lg border-[1.5px] border-danger/30 bg-danger/10 px-2.5 py-1 text-[11px] font-extrabold text-danger">
        {t("miss")}
      </span>
    );
  }
  return (
    <span className="rounded-lg border-[1.5px] border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-extrabold text-success">
      +{points} {t("pts")}
    </span>
  );
}

function formatPredictionLabel(
  p: HistoryEntry["prediction"],
  t: ReturnType<typeof useTranslations<"history">>,
): string {
  switch (p.kind) {
    case "exact":
      return `${p.predictedHomeScore ?? 0}-${p.predictedAwayScore ?? 0}`;
    case "simple":
      if (p.predictedWinner === "home") return t("predLocal");
      if (p.predictedWinner === "away") return t("predAway");
      return t("predDraw");
    case "double-1x":
      return t("predDouble1x");
    case "double-x2":
      return t("predDoubleX2");
    case "double-12":
      return t("predDouble12");
  }
}
