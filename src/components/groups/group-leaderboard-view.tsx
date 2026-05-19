import { PodiumCard } from "@/components/leaderboard/podium-card";
import { RankRow } from "@/components/leaderboard/rank-row";
import { countryCodeToFlag } from "@/lib/format/country";
import type { Player } from "@/lib/leaderboard/types";
import type { GroupRankingEntry } from "@/server/groups/types";

type Props = {
  entries: GroupRankingEntry[];
  /** Si se pasa, se renderiza arriba como `<header>` (nombre del grupo
   * o "Ranking entre amigos"). Si no, solo el contenido. */
  title?: string;
  countLabel?: string;
};

/**
 * Vista del ranking dentro de `/ranking?scope=amigos` o
 * `?scope=grupos`. Mismo look-and-feel que el ranking global:
 *  - Top-3 como podio (con corona, plata, bronce).
 *  - Resto como filas con rachas, badge de aciertos y delta rank.
 *
 * Convierte `GroupRankingEntry` → `Player` para reutilizar
 * `<PodiumCard>` y `<RankRow>` sin duplicar diseño.
 *
 * Ex-miembros congelados (`frozen: true`) NO se promueven al podio
 * aunque tengan los puntos suficientes — sería confuso pintarlos como
 * top con corona. Quedan como filas normales con badge "Ex".
 */
export function GroupLeaderboardView({ entries, title, countLabel }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-6 text-center text-[12px] font-bold text-muted">
        Aún no hay miembros en el ranking. Cuando alguien acierte una
        predicción aparecerá aquí.
      </div>
    );
  }

  const players = entries.map(toPlayer);
  // Top-3 solo si NO son frozen (no premiamos ex-miembros en el podio).
  const podiumCandidates = entries.slice(0, 3);
  const allTop3Active = podiumCandidates.length === 3 && podiumCandidates.every((e) => !e.frozen);
  const showPodium = allTop3Active;
  const podiumPlayers = showPodium ? players.slice(0, 3) : [];
  const restStart = showPodium ? 3 : 0;
  const restPlayers = players.slice(restStart);

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

      {showPodium && (
        <div className="mb-4 grid grid-cols-[1fr_1.1fr_1fr] items-end gap-2 opacity-0 [animation:popIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)_0.18s_forwards]">
          <PodiumCard player={podiumPlayers[1]!} place={2} />
          <PodiumCard player={podiumPlayers[0]!} place={1} />
          <PodiumCard player={podiumPlayers[2]!} place={3} />
        </div>
      )}

      {showPodium && restPlayers.length > 0 && (
        <div
          aria-hidden="true"
          className="my-3.5 flex items-center gap-2.5 opacity-0 [animation:fadeUp_0.4s_ease_0.3s_forwards]"
        >
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm opacity-50">⚽</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {restPlayers.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {restPlayers.map((player, i) => {
            const original = entries[restStart + i]!;
            return (
              <li key={player.id} className={original.frozen ? "opacity-70" : ""}>
                {original.frozen ? (
                  <div className="pointer-events-none">
                    <RankRow player={player} index={i} />
                  </div>
                ) : (
                  <RankRow player={player} index={i} />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * Adapter de `GroupRankingEntry` → `Player` para reusar los
 * componentes de leaderboard. Los campos que el `Player` shape exige
 * y `GroupRankingEntry` no tiene:
 *  - `countryName`: usamos el código como fallback (no tenemos los
 *    nombres traducidos a mano aquí).
 *  - `flag`: emoji bandera derivado del country code; vacío si null.
 *  - `previousRank`: si tenemos `rankDelta`, lo derivamos
 *    (`rank + rankDelta`); si no, igual al rank actual (sin flecha).
 *  - `isOnline`: false. No tracking de online en este shape — si
 *    es importante, lo añadimos al server query.
 */
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
  };
}
