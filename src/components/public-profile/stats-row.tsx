import { type PointsLocale, formatPoints } from "@/lib/format/number";
import type { ProfileStats } from "@/server/public-profile/types";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  stats: ProfileStats;
};

/**
 * Dos stat cards lado a lado: rank global (gold) y puntos (blue/green).
 * El ranking es inamovible (todos los users registrados aparecen),
 * así que `stats.rank` siempre es un número — incluso usuarios sin
 * puntos tienen una posición real (al final de la cola).
 */
export function StatsRow({ stats }: Props) {
  const t = useTranslations("publicProfile");
  const locale = useLocale() as PointsLocale;

  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5">
      <StatCard
        tone="rank"
        value={`#${stats.rank}`}
        label={t("rankLabel")}
        sub={t("rankOfTotal", { total: formatPoints(stats.totalPlayers, locale) })}
      />
      <StatCard
        tone="pts"
        value={formatPoints(stats.points, locale)}
        label={t("pointsLabel")}
        sub={
          stats.pointsDelta === null
            ? t("weeklyDeltaNone")
            : stats.pointsDelta > 0
              ? t("weeklyDeltaUp", { delta: stats.pointsDelta })
              : stats.pointsDelta < 0
                ? t("weeklyDeltaDown", { delta: Math.abs(stats.pointsDelta) })
                : t("weeklyDeltaFlat")
        }
      />
    </div>
  );
}

function StatCard({
  tone,
  value,
  label,
  sub,
}: {
  tone: "rank" | "pts";
  value: string;
  label: string;
  sub: string;
}) {
  const valueClass = tone === "rank" ? "text-gold" : "text-foreground";
  const accentClass =
    tone === "rank"
      ? "bg-gradient-to-b from-gold to-bronze"
      : "bg-gradient-to-b from-info to-success";
  return (
    <article
      aria-label={label}
      className="relative overflow-hidden rounded-2xl border-2 border-border bg-card px-4 py-4"
    >
      <span
        aria-hidden="true"
        className={`absolute bottom-0 start-0 top-0 w-[3px] rounded-s-[2px] ${accentClass}`}
      />
      <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">
        {label}
      </div>
      <div className={`mb-1 font-display text-[30px] leading-none tracking-[-1px] ${valueClass}`}>
        {value}
      </div>
      <div className="text-[11px] font-bold text-muted">{sub}</div>
    </article>
  );
}
