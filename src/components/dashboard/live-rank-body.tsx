"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  /** Rank con el que se hizo SSR. Se sustituye en cuanto llega el primer evento SSE. */
  initialRank: number;
  /**
   * Rank de hace ~24h según el snapshot histórico (o `null` si
   * todavía no hay baseline). Se usa para calcular el delta: si
   * `dayAgoRank < rank` el user empeoró; si mayor, mejoró.
   */
  dayAgoRank: number | null;
  /**
   * Serie de los snapshots ya consolidados (NO incluye el rank
   * actual). Si no hay snapshots, `null`. Para la sparkline, se
   * concatena el rank live al final.
   */
  historical: number[] | null;
};

/**
 * Bloque dinámico de la card "Tu posición". Conecta al SSE
 * `/api/leaderboard/stream` y actualiza el `#N`, el delta y el
 * último punto de la sparkline sin recargar.
 *
 * Mensaje SSE (extendido para incluir `myRank`):
 *   `event: snapshot` → `data: { ..., myRank: number | null }`
 *
 * Si `myRank` es `null` (sin sesión o user fuera de top que no se
 * resolvió), mantenemos el `initialRank` SSR — degradación silenciosa.
 */
export function LiveRankBody({ initialRank, dayAgoRank, historical }: Props) {
  const t = useTranslations("dashboard.progress");
  const [rank, setRank] = useState(initialRank);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/leaderboard/stream");
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { myRank?: number | null };
        if (typeof data.myRank === "number" && data.myRank > 0) {
          setRank(data.myRank);
        }
      } catch {
        // Ignorar payloads corruptos — el siguiente tick (15s) traerá uno nuevo.
      }
    };
    es.addEventListener("snapshot", handler);
    return () => {
      es.removeEventListener("snapshot", handler);
      es.close();
    };
  }, []);

  const delta = dayAgoRank === null ? null : dayAgoRank - rank;
  const sparkline = historical === null ? null : [...historical, rank];

  return (
    <>
      <div className="mb-2 font-display text-[28px] leading-none tracking-[-0.5px] text-gold">
        {`#${rank}`}
      </div>
      <RankDeltaLine delta={delta} />
      {sparkline && sparkline.length >= 2 && (
        <Sparkline points={sparkline} ariaLabel={t("sparklineAria")} />
      )}
    </>
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

/**
 * Mini-gráfica del rank en el tiempo. Eje Y invertido: rank 1 va
 * arriba del SVG (porque numéricamente menor = mejor). Polyline
 * gold, dos puntos en los extremos para anclar la lectura.
 */
function Sparkline({ points, ariaLabel }: { points: number[]; ariaLabel: string }) {
  const width = 120;
  const height = 28;
  const pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: pad + i * step,
    y: pad + ((p - min) / span) * (height - pad * 2),
  }));
  const d = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (!first || !last) return null;
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      className="mt-1 h-7 w-full"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={first.x} cy={first.y} r="2" fill="var(--color-gold)" opacity="0.5" />
      <circle cx={last.x} cy={last.y} r="2.5" fill="var(--color-gold)" />
    </svg>
  );
}
