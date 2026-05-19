import { useTranslations } from "next-intl";
import { PodiumPlaceholder } from "@/components/groups/podium-placeholder";
import { PodiumCard } from "@/components/leaderboard/podium-card";
import { RankRow } from "@/components/leaderboard/rank-row";
import { countryCodeToFlag } from "@/lib/format/country";
import type { Player } from "@/lib/leaderboard/types";
import type { GroupRankingEntry } from "@/server/groups/types";

type Props = {
  entries: GroupRankingEntry[];
  title?: string;
  countLabel?: string;
};

/**
 * Vista del ranking de grupos/amigos. Reutiliza `PodiumCard` y
 * `RankRow` del global. Top-3 siempre visible (con
 * `<PodiumPlaceholder>` si faltan miembros activos). Frozen
 * (ex-miembros) van a filas con `opacity-70` + badge "ha salido".
 */
export function GroupLeaderboardView({ entries, title, countLabel }: Props) {
  const t = useTranslations("groups.ranking");
  const active = entries.filter((e) => !e.frozen);
  const frozen = entries.filter((e) => e.frozen);

  const podiumSlots: Array<GroupRankingEntry | null> = [
    active[0] ?? null,
    active[1] ?? null,
    active[2] ?? null,
  ];
  const rest = [...active.slice(3), ...frozen];

  return (
    <div className="mx-auto w-full max-w-[510px]">
      {(title || countLabel) && (
        <header className="mb-3 flex items-center justify-between">
          {title && (
            <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
              {title}
            </h2>
          )}
          {countLabel && (
            <span className="text-[11px] font-bold text-muted">{countLabel}</span>
          )}
        </header>
      )}

      <div className="mb-4 grid grid-cols-[1fr_1.1fr_1fr] items-end gap-2 opacity-0 [animation:popIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)_0.18s_forwards]">
        {podiumSlots[1] ? (
          <PodiumCard player={toPlayer(podiumSlots[1])} place={2} />
        ) : (
          <PodiumPlaceholder place={2} />
        )}
        {podiumSlots[0] ? (
          <PodiumCard player={toPlayer(podiumSlots[0])} place={1} />
        ) : (
          <PodiumPlaceholder place={1} />
        )}
        {podiumSlots[2] ? (
          <PodiumCard player={toPlayer(podiumSlots[2])} place={3} />
        ) : (
          <PodiumPlaceholder place={3} />
        )}
      </div>

      {rest.length > 0 && (
        <>
          <div
            aria-hidden="true"
            className="my-3.5 flex items-center gap-2.5 opacity-0 [animation:fadeUp_0.4s_ease_0.3s_forwards]"
          >
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm opacity-50">⚽</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <ol className="flex flex-col gap-1.5">
            {rest.map((entry, i) => (
              <li key={entry.userId} className={entry.frozen ? "opacity-70" : ""}>
                <RankRow
                  player={toPlayer(entry)}
                  index={i}
                  nameSuffix={entry.frozen ? <LeftBadge /> : null}
                />
              </li>
            ))}
          </ol>
        </>
      )}

      {entries.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-6 text-center text-[12px] font-bold text-muted">
          {t("emptyMembers")}
        </div>
      )}
    </div>
  );
}

/**
 * Badge "Ha salido" / "Left" / etc. Pequeño, junto al nombre del
 * miembro congelado. Si vuelve a entrar, `frozen` pasa a false y el
 * badge desaparece automáticamente.
 */
function LeftBadge() {
  const t = useTranslations("groups.badge");
  return (
    <span className="ml-1 shrink-0 rounded-full border border-warm/40 bg-warm/[0.08] px-1.5 py-px text-[9px] font-black uppercase tracking-[0.1em] text-warm">
      {t("leftMember")}
    </span>
  );
}

function toPlayer(e: GroupRankingEntry): Player {
  return {
    id: e.userId,
    username: e.username,
    name: e.name,
    countryCode: e.countryCode ?? "",
    countryName: e.countryCode ?? "",
    flag: countryCodeToFlag(e.countryCode) ?? "🌍",
    points: e.points,
    streak: e.streak,
    correctCount: e.correctCount,
    rank: e.rank,
    previousRank: e.rankDelta !== null ? e.rank + e.rankDelta : e.rank,
    isOnline: false,
    avatarId: e.avatarId,
    image: e.image,
  };
}
