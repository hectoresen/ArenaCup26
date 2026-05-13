import type { Progress } from "@/server/dashboard/types";
import { useTranslations } from "next-intl";

type Props = {
  progress: Progress;
  /** Para tests: forzar "ahora" en el cálculo de "hace X días". */
  now?: Date;
};

/**
 * Grid de dos cards: Logros desbloqueados y Posición global. Si el
 * progreso de ranking no tiene histórico (`sparkline === null` y
 * `rankDelta === null`), la card de ranking muestra el placeholder
 * "Empezamos a registrar el 11 de junio".
 */
export function ProgressCards({ progress, now }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5 max-[520px]:grid-cols-1">
      <AchievementsProgressCard progress={progress} now={now} />
      <RankProgressCard progress={progress} />
    </div>
  );
}

function AchievementsProgressCard({
  progress,
  now = new Date(),
}: { progress: Progress; now?: Date }) {
  const t = useTranslations("dashboard.progress");
  const { unlocked, total, lastUnlockedTitle, lastUnlockedAt } = progress.achievements;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  const days = lastUnlockedAt ? daysSince(lastUnlockedAt, now) : null;

  return (
    <article
      aria-label={t("achievementsLabel")}
      className="relative overflow-hidden rounded-2xl border-2 border-border bg-card px-4 py-4 [animation:slideIn_0.45s_ease_forwards] opacity-0"
    >
      <CardAccent />
      <div className="mb-3 flex items-center gap-2.5">
        <IconBox>🏆</IconBox>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">
          {t("achievementsLabel")}
        </div>
      </div>
      <div className="mb-2 font-display text-[28px] leading-none text-gold">
        {unlocked} <span className="text-base text-muted">/ {total}</span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold transition-all duration-1000"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mb-2.5 text-[11px] font-bold leading-[1.4] text-muted">
        {lastUnlockedTitle && days !== null
          ? t("lastUnlocked", { title: lastUnlockedTitle, days })
          : t("lastUnlockedNone")}
      </div>
    </article>
  );
}

function RankProgressCard({ progress }: { progress: Progress }) {
  const t = useTranslations("dashboard.progress");
  const { rank, rankDelta, sparkline } = progress.rank;
  const hasHistory = rankDelta !== null || sparkline !== null;

  return (
    <article
      aria-label={t("rankLabel")}
      className="relative overflow-hidden rounded-2xl border-2 border-border bg-card px-4 py-4 [animation:slideIn_0.45s_ease_forwards] opacity-0"
    >
      <CardAccent />
      <div className="mb-3 flex items-center gap-2.5">
        <IconBox>📊</IconBox>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">
          {t("rankLabel")}
        </div>
      </div>
      <div className="mb-2 font-display text-[28px] leading-none tracking-[-0.5px] text-gold">
        {rank === null ? "—" : `#${rank}`}
      </div>

      {hasHistory ? (
        <RankDeltaLine delta={rankDelta} />
      ) : (
        <div className="mb-2.5 text-[11px] font-bold leading-[1.4] text-muted">
          {t("historyStarting")}
        </div>
      )}
    </article>
  );
}

function RankDeltaLine({ delta }: { delta: number | null }) {
  const t = useTranslations("dashboard.progress");
  if (delta === null) return null;
  if (delta > 0) {
    return (
      <div className="mb-2.5 text-[11px] font-bold leading-[1.4] text-muted">
        <span className="font-black text-success">{t("rankDeltaUp", { delta })}</span>
      </div>
    );
  }
  if (delta < 0) {
    return (
      <div className="mb-2.5 text-[11px] font-bold leading-[1.4] text-muted">
        <span className="font-black text-danger">
          {t("rankDeltaDown", { delta: Math.abs(delta) })}
        </span>
      </div>
    );
  }
  return (
    <div className="mb-2.5 text-[11px] font-bold leading-[1.4] text-muted">
      {t("rankDeltaFlat")}
    </div>
  );
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-gold/20 bg-gold/10 text-base"
    >
      {children}
    </span>
  );
}

function CardAccent() {
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-0 start-0 top-0 w-[3px] rounded-s-[2px] bg-gradient-to-b from-gold to-bronze"
    />
  );
}

/**
 * Días enteros transcurridos entre dos fechas (UTC). Si `since` está
 * en el futuro, devuelve 0.
 */
function daysSince(since: Date, now: Date): number {
  const ms = now.getTime() - since.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
