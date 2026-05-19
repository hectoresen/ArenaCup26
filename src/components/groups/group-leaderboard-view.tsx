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
 * Vista del ranking dentro de `/ranking?scope=amigos`,
 * `?scope=grupos` y `/social/grupos/[id]`. Mismo look-and-feel que el
 * ranking global:
 *  - **Siempre** las 3 tarjetas del podio arriba. Si una posición no
 *    tiene ocupante (grupo con < 3 miembros activos), `<PodiumPlaceholder>`
 *    renderiza copy juguetón con animación de blink invitando a ocupar
 *    el puesto.
 *  - Resto de miembros como `<RankRow>` con rachas, badge de aciertos
 *    y flechas de delta.
 *
 * Reglas de la podio:
 *  - Solo miembros ACTIVOS pueden ocupar el podio. Los ex-miembros
 *    congelados aparecen en filas con `opacity-70`, nunca en las 3
 *    tarjetas (sería incoherente "celebrar" a alguien que abandonó).
 *  - Si hay menos de 3 activos, los slots vacíos se rellenan con
 *    placeholders. El primero en aparecer es el más alto disponible.
 */
export function GroupLeaderboardView({ entries, title, countLabel }: Props) {
  // Partición: activos vs congelados. Solo activos optan al podio.
  const active = entries.filter((e) => !e.frozen);
  const frozen = entries.filter((e) => e.frozen);

  const podiumSlots: Array<GroupRankingEntry | null> = [
    active[0] ?? null,
    active[1] ?? null,
    active[2] ?? null,
  ];

  // El resto: activos a partir del 4º + todos los congelados al final.
  // Mantenemos el rank original de cada entry (viene precomputado del
  // server) para que la columna "#" y el orden coincidan con la fila.
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

      {/* Podio siempre visible — 2º (izquierda), 1º (centro), 3º (derecha). */}
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
    </div>
  );
}

/**
 * Badge "Ha salido" que se renderiza junto al nombre del miembro
 * congelado en el ranking del grupo. Pequeño, no agresivo. Si el
 * ex-miembro vuelve a entrar (vía re-invitación), `frozen` pasa a
 * `false` y el badge desaparece automáticamente.
 */
function LeftBadge() {
  return (
    <span className="ml-1 shrink-0 rounded-full border border-warm/40 bg-warm/[0.08] px-1.5 py-px text-[9px] font-black uppercase tracking-[0.1em] text-warm">
      Ha salido
    </span>
  );
}

/**
 * Adapter de `GroupRankingEntry` → `Player`. Reutilizamos los
 * componentes del leaderboard global sin tocarlos.
 *
 * - `countryName`: usamos el código como fallback (i18n de países
 *   queda para iteración aparte; el código mostrado es ISO-2).
 * - `flag`: emoji bandera derivado del country code.
 * - `previousRank`: si tenemos `rankDelta`, lo derivamos
 *   (`rank + rankDelta`); si no, igual al rank actual (sin flecha).
 * - `isOnline`: false. Si en el futuro queremos puntito verde, se
 *   añade el campo al server query.
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
