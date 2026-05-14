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
