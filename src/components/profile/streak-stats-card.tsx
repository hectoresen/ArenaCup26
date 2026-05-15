import { useTranslations } from "next-intl";
import type { OwnerStreakStats } from "@/server/profile/owner-extras";

type Props = {
  stats: OwnerStreakStats;
};

/**
 * Caja "Tus rachas" en el perfil del dueño. Tres mini-stats: racha
 * actual, mejor racha histórica, y cuántas veces ha alcanzado un
 * milestone (≥3 aciertos seguidos).
 */
export function StreakStatsCard({ stats }: Props) {
  const t = useTranslations("profileEditor.streakCard");
  return (
    <section
      aria-label={t("title")}
      className="mt-4 rounded-2xl border-2 border-border bg-card p-4"
    >
      <header className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className="text-xl leading-none">
          🔥
        </span>
        <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-gold">
          {t("title")}
        </h2>
      </header>
      <ul className="m-0 flex list-none gap-2.5 p-0">
        <StreakStat value={stats.current} label={t("current")} />
        <StreakStat value={stats.max} label={t("max")} />
        <StreakStat value={stats.milestoneCount} label={t("milestones")} />
      </ul>
    </section>
  );
}

function StreakStat({ value, label }: { value: number; label: string }) {
  return (
    <li className="flex-1 rounded-xl border-2 border-border bg-card-hover px-2.5 py-3 text-center">
      <span className="block font-display text-[22px] leading-none text-warm">{value}</span>
      <span className="mt-0.5 block text-[9px] font-black uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
    </li>
  );
}
