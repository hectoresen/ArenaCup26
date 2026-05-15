import { type PointsLocale, formatPoints } from "@/lib/format/number";
import { firstName } from "@/server/dashboard/transforms";
import type { UserStats } from "@/server/dashboard/types";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  userName: string;
  stats: UserStats;
};

/**
 * Bloque superior del panel: saludo personal + subtítulo con ranking
 * + tres mini-stats (puntos, racha, logros).
 *
 * Si `stats.rank === null` (usuario nuevo, aún sin actividad) el
 * subtítulo cambia a "Empieza tu primera predicción" en lugar del
 * "Vas el #X de Y jugadores".
 */
export function Hero({ userName, stats }: Props) {
  const t = useTranslations("dashboard");
  const locale = useLocale() as PointsLocale;
  const first = firstName(userName);
  const isNew = stats.rank === null;

  // Mostrar el chip de racha al lado del saludo solo cuando hay
  // racha activa (≥1). Cero → no se muestra (no aporta nada). La
  // antigua card central de "streak" se sustituye por "posición"
  // que es mucho más accionable para el user.
  const streakActive = stats.streak >= 1;

  return (
    <section
      aria-label={t("subtitle", { rank: stats.rank ?? 0, total: stats.totalPlayers })}
      className="mb-1 [animation:fadeUp_0.55s_ease_0.06s_forwards] opacity-0"
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="font-display text-[30px] leading-[1.1] tracking-[0.02em]">
          {first
            ? t.rich("greeting", {
                name: first,
                em: (chunks) => <em className="not-italic text-gold">{chunks}</em>,
              })
            : t("greetingNew")}
        </div>
        {streakActive && (
          <span
            aria-label={t("miniStats.streak") + ` ${stats.streak}`}
            className="mt-1 flex-shrink-0 rounded-full border-[1.5px] border-warm/40 bg-warm/[0.08] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-warm"
          >
            🔥 {t("streakChip", { count: stats.streak })}
          </span>
        )}
      </div>
      <div className="mb-[18px] text-[13px] font-bold text-muted">
        {isNew
          ? t("subtitleNew")
          : t("subtitle", {
              rank: stats.rank ?? 0,
              // Pre-formateamos el total como string para evitar que
              // next-intl lo pase por Intl.NumberFormat (small-icu cae
              // a en-US y produce "12480" en vez de "12.480").
              total: formatPoints(stats.totalPlayers, locale),
            })}
      </div>

      <ul aria-label={t("miniStats.points")} className="m-0 flex list-none gap-2.5 p-0">
        <MiniStat
          value={formatPoints(stats.totalPoints, locale)}
          label={t("miniStats.points")}
          tone="gold"
          ariaLabel={`${stats.totalPoints} ${t("miniStats.points")}`}
        />
        <MiniStat
          value={stats.rank !== null ? `#${stats.rank}` : "—"}
          label={t("miniStats.rank")}
          tone="gold"
          ariaLabel={
            stats.rank !== null
              ? `${t("miniStats.rank")} ${stats.rank}`
              : t("miniStats.rankNone")
          }
        />
        <MiniStat
          value={`${stats.achievementsUnlocked}/${stats.achievementsTotal}`}
          label={t("miniStats.achievements")}
          tone="gold"
          ariaLabel={`${stats.achievementsUnlocked} ${t("miniStats.achievements")} ${stats.achievementsTotal}`}
        />
      </ul>
    </section>
  );
}

function MiniStat({
  value,
  label,
  tone,
  ariaLabel,
}: {
  value: string;
  label: string;
  tone: "gold" | "amber";
  ariaLabel: string;
}) {
  const toneClass = tone === "gold" ? "text-gold" : "text-warm";
  return (
    <li
      aria-label={ariaLabel}
      className="flex-1 rounded-[14px] border-2 border-border bg-card px-2.5 py-3 text-center transition-transform duration-200 hover:-translate-y-[3px] hover:border-gold/30"
    >
      <span className={`mb-[3px] block font-display text-[22px] leading-none ${toneClass}`}>
        {value}
      </span>
      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted">{label}</span>
    </li>
  );
}
