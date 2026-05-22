import { LocalTime } from "@/components/common/local-time";
import { TeamFlag } from "@/components/common/team-flag";
import { Link } from "@/i18n/navigation";
import { type SupportedLocale, formatMatchDate } from "@/lib/format/date";
import type { HistoryEntry } from "@/server/history/types";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  entry: HistoryEntry;
  now?: Date;
};

/**
 * Card de una predicción pasada con feedback explícito:
 *  - Header: fecha + hora local + status badge.
 *  - Cuerpo: equipos + marcador real (si el partido terminó).
 *  - Footer: tu predicción (kind+valor) + outcome (✓/✗/⏳) + puntos.
 *
 * Click → detalle del partido.
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
          <strong className="text-foreground">{date}</strong> · <LocalTime date={entry.kickoffAt} />
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

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 border-t border-border pt-2.5">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
            {t("yourPrediction")}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <KindBadge kind={entry.prediction.kind} />
            <span className="truncate text-[13px] font-bold text-foreground">
              {formatPredictionLabel(entry.prediction, entry.homeTeam.name, entry.awayTeam.name, t)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end justify-center gap-1">
          <OutcomeBadge entry={entry} />
          <PointsBadge points={entry.pointsEarned} t={t} />
        </div>
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

function KindBadge({ kind }: { kind: HistoryEntry["prediction"]["kind"] }) {
  const t = useTranslations("history.kind");
  let label: string;
  let cls: string;
  if (kind === "exact") {
    label = t("exact");
    cls = "border-info/30 bg-info/10 text-info";
  } else if (kind === "simple") {
    label = t("simple");
    cls = "border-border bg-card-hover text-muted";
  } else {
    label = t("double");
    cls = "border-warm/30 bg-warm/10 text-warm";
  }
  return (
    <span
      className={`shrink-0 rounded-md border px-1.5 py-px text-[9px] font-black uppercase tracking-[0.08em] ${cls}`}
    >
      {label}
    </span>
  );
}

/**
 * Feedback explícito: acertaste / fallaste / pendiente. De un vistazo
 * el user sabe cómo le fue sin tener que comparar números.
 */
function OutcomeBadge({ entry }: { entry: HistoryEntry }) {
  const t = useTranslations("history.outcome");
  if (entry.pointsEarned === null) {
    return (
      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
        ⏳ {t("pending")}
      </span>
    );
  }
  if (entry.pointsEarned > 0) {
    return (
      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-success">
        ✓ {t("hit")}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-danger">
      ✗ {t("miss")}
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

/**
 * Convierte una predicción en una frase legible nombrando equipos
 * concretos en lugar de los términos genéricos "Local" / "Visitante"
 * (que no resuenan en un torneo entre selecciones). Ejemplos:
 *  - simple+home → "Argentina"
 *  - simple+draw → "Empate"
 *  - double-1x   → "Argentina o empate"
 *  - double-x2   → "Empate o Brasil"
 *  - double-12   → "Argentina o Brasil"
 *  - exact       → "3-1"
 */
function formatPredictionLabel(
  p: HistoryEntry["prediction"],
  homeName: string,
  awayName: string,
  t: ReturnType<typeof useTranslations<"history">>,
): string {
  switch (p.kind) {
    case "exact":
      return `${p.predictedHomeScore ?? 0}-${p.predictedAwayScore ?? 0}`;
    case "simple":
      if (p.predictedWinner === "home") return homeName;
      if (p.predictedWinner === "away") return awayName;
      return t("predDraw");
    case "double-1x":
      return t("predHomeOrDraw", { team: homeName });
    case "double-x2":
      return t("predDrawOrAway", { team: awayName });
    case "double-12":
      return t("predHomeOrAway", { home: homeName, away: awayName });
  }
}
