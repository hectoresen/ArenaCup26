"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  /** Milisegundos entre refreshes. Por defecto 30s. */
  intervalMs?: number;
};

/**
 * Polling client-side: cada N segundos llama `router.refresh()` para
 * que SSR re-evalúe el dashboard (scores live, puntos provisionales,
 * ranking si cambia). Solo debe montarse cuando hay un match en
 * `live` — el caller condiciona el render.
 *
 * Se sustituirá por SSE/WebSocket nativo cuando aterrice
 * `add-leaderboard-sse`. Hasta entonces este polling tonto basta para
 * validar el flujo end-to-end.
 *
 * No pinta nada en el DOM.
 */
export function LiveAutoRefresh({ intervalMs = 30_000 }: Props) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}

type PreKickoffProps = {
  /** Fecha de inicio del próximo partido. */
  kickoffAt: Date;
  /** Ventana en ms alrededor del kickoff durante la cual se hace polling. */
  windowMs?: number;
  /** Intervalo de polling dentro de la ventana. */
  intervalMs?: number;
};

/**
 * Polling más lento (60s por defecto) para capturar la transición
 * `scheduled → live` en el servidor. Solo refresca dentro de una
 * ventana de ±30 min alrededor del kickoff — antes el live-scoring
 * cron aún no ha tocado el match, y después de 30 min sin haber
 * pasado a `live` lo más probable es que el partido se haya pospuesto.
 *
 * Sin esto, un usuario en /inicio con el partido scheduled se queda
 * con la vista stale hasta recargar manualmente, aunque el cron haya
 * marcado el match como `live` minutos antes.
 */
export function PreKickoffAutoRefresh({
  kickoffAt,
  windowMs = 30 * 60 * 1000,
  intervalMs = 60_000,
}: PreKickoffProps) {
  const router = useRouter();
  useEffect(() => {
    const kickoffMs = kickoffAt.getTime();
    const tick = () => {
      const now = Date.now();
      const delta = Math.abs(now - kickoffMs);
      if (delta <= windowMs) {
        router.refresh();
      }
    };
    const id = setInterval(tick, intervalMs);
    tick();
    return () => clearInterval(id);
  }, [router, kickoffAt, windowMs, intervalMs]);
  return null;
}
