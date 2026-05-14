import type { DashboardData } from "@/server/dashboard/types";
import { useTranslations } from "next-intl";
import { Hero } from "./hero";
import { LiveAutoRefresh } from "./live-auto-refresh";
import { LiveSection } from "./live-section";
import { MatchCard } from "./match-card";
import { MiniLeaderboard } from "./mini-leaderboard";
import { ProgressCards } from "./progress-cards";

/**
 * Ensambla todos los bloques del panel. Aislado en su propio archivo
 * (no en `page.tsx`) para poder testarlo en jsdom sin que vitest
 * intente cargar `next/server` (que `auth()` arrastra).
 */
export function DashboardSections({ data }: { data: DashboardData }) {
  const t = useTranslations("dashboard.sections");

  return (
    <>
      <Hero userName={data.userName} stats={data.stats} />

      {/* Si hay live, sondeamos el server cada 30s para refrescar
          scores + puntos provisionales sin que el user pulse F5.
          Cuando aterrice add-leaderboard-sse se sustituye por push. */}
      {data.live && <LiveAutoRefresh />}

      <LiveSection live={data.live} nextMatch={data.nextMatch} />

      {data.upcoming.length > 0 && (
        <>
          <SectionLabel title={t("upcoming")} />
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.upcoming.map((match) => (
              <li key={match.matchId}>
                <MatchCard match={match} />
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionLabel title={t("progress")} />
      <ProgressCards progress={data.progress} />

      <SectionLabel title={t("miniLeaderboard")} />
      <MiniLeaderboard mini={data.mini} />
    </>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="my-3.5 flex items-center gap-2.5 [animation:fadeUp_0.4s_ease_forwards] opacity-0">
      <div className="h-px flex-1 bg-border" />
      <span className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
        {title}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
