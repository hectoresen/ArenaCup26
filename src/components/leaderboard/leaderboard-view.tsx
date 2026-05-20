"use client";

import { CountryFlag } from "@/components/common/country-flag";
import { LocalTime } from "@/components/common/local-time";
import { TopChrome } from "@/components/layout/top-chrome";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import type { LeaderboardEvent, LeaderboardSnapshot } from "@/lib/leaderboard/types";
import { useTranslations } from "next-intl";
import { FloatingBalls } from "./floating-balls";
import { LiveBadge } from "./live-badge";
import { PodiumCard } from "./podium-card";
import { RankRow } from "./rank-row";
import { TrophyLogo } from "./trophy-logo";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function LeaderboardView({
  snapshot: initialSnapshot,
  user,
  events: _events,
  /**
   * `true` (default) → renderiza `<TopChrome>` + `<FloatingBalls>` para
   * uso standalone en la landing pública. `false` → solo el contenido
   * para anidarse dentro de un layout con shell propio (área logada).
   */
  withChrome = true,
}: {
  snapshot: LeaderboardSnapshot;
  user: SessionUser | null;
  events?: LeaderboardEvent[];
  withChrome?: boolean;
}) {
  const t = useTranslations("leaderboard");
  // SSE: el snapshot inicial viene de SSR; tras montar, nos suscribimos a
  // `/api/leaderboard/stream` para recibir actualizaciones cada 15s sin
  // recargar la página. Si el browser no soporta EventSource o la
  // conexión falla, simplemente seguimos con el snapshot inicial.
  const snapshot = useLiveSnapshot<LeaderboardSnapshot>(
    "/api/leaderboard/stream",
    "snapshot",
    initialSnapshot,
  );
  const [first, second, third, ...rest] = snapshot.players;

  return (
    <>
      {withChrome && <FloatingBalls count={7} />}
      {withChrome && <TopChrome user={user} />}
      <div className="relative z-10 mx-auto w-full max-w-[510px]">
        <header className="mb-6 text-center opacity-0 [animation:popIn_0.7s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
          <div className="mb-2.5 flex items-center justify-center gap-3.5">
            <TrophyLogo className="animate-[trophyFloat_3.5s_ease-in-out_infinite] drop-shadow-[0_4px_20px_rgba(245,200,66,0.45)]" />
            <div>
              <div className="mb-0.5 font-display text-[11px] uppercase tracking-[0.28em] text-muted">
                We Are
              </div>
              <div
                className="font-display text-[68px] leading-none tracking-[-4px] text-transparent opacity-90"
                style={{ WebkitTextStroke: "3px var(--color-gold)" }}
              >
                26
              </div>
            </div>
          </div>
          <div className="mb-2.5 font-display text-[13px] uppercase tracking-[0.18em] text-gold opacity-80">
            {t("tagline")}
          </div>
          <div className="mb-3 flex items-center justify-center gap-2">
            <CountryFlag code="CA" name={t("hostFlags.canada")} size={28} className="rounded-sm" />
            <CountryFlag code="MX" name={t("hostFlags.mexico")} size={28} className="rounded-sm" />
            <CountryFlag code="US" name={t("hostFlags.usa")} size={28} className="rounded-sm" />
          </div>
          <LiveBadge>{t("liveBadge")}</LiveBadge>
          {!user && (
            <p className="mx-auto mt-4 max-w-[480px] text-[12px] font-bold leading-relaxed text-muted">
              {t("marketingCopy")}
            </p>
          )}
        </header>

        {first && second && third && (
          <div className="mb-4 grid grid-cols-[1fr_1.1fr_1fr] items-end gap-2 opacity-0 [animation:popIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)_0.18s_forwards]">
            <PodiumCard player={second} place={2} />
            <PodiumCard player={first} place={1} />
            <PodiumCard player={third} place={3} />
          </div>
        )}

        <div
          aria-hidden="true"
          className="my-3.5 flex items-center gap-2.5 opacity-0 [animation:fadeUp_0.4s_ease_0.3s_forwards]"
        >
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm opacity-50">⚽</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <ol className="flex flex-col gap-1.5">
          {rest.map((player, i) => (
            <li key={player.id}>
              <RankRow player={player} index={i} />
            </li>
          ))}
        </ol>

        <footer className="mt-4 flex items-center justify-between px-0.5 opacity-0 [animation:fadeUp_0.4s_ease_1s_forwards]">
          {/* `generatedAt` viene del server en UTC; `<LocalTime>`
              re-renderiza en hora del navegador tras hidratar para que
              el usuario nunca vea horas "raras" de zonas ajenas. El
              color verde refuerza que es un valor vivo. */}
          <span className="text-[11px] font-bold text-success">
            ⏱ {t("footer.updatedAt")} <LocalTime date={snapshot.generatedAt} />
          </span>
          <span className="font-display text-xs uppercase tracking-[0.1em] text-gold opacity-60">
            WE ARE 26
          </span>
        </footer>
      </div>
    </>
  );
}
