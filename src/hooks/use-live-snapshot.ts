"use client";

import { useEffect, useState } from "react";

/**
 * Hook genérico que se suscribe a un endpoint SSE y mantiene el
 * último snapshot recibido como state. Acepta un `initial` (renderizado
 * server-side) que se usa hasta que llega el primer mensaje y como
 * fallback si el browser no soporta EventSource.
 *
 * - `url`: endpoint SSE (relativo o absoluto).
 * - `eventName`: nombre del evento SSE a escuchar (`data:` con
 *   `event: <eventName>`). El handler ignora otros eventos.
 * - `initial`: snapshot inicial. Tipo libre, debe ser JSON-serializable.
 *
 * Reconexión: EventSource reintenta automáticamente si la conexión
 * cae. El componente se queda con el último snapshot válido entre
 * reintentos — nunca degrada el state a "loading".
 */
export function useLiveSnapshot<T>(url: string, eventName: string, initial: T): T {
  const [snapshot, setSnapshot] = useState<T>(initial);

  useEffect(() => {
    // SSR/Node: EventSource no existe → mantener initial.
    if (typeof EventSource === "undefined") return;

    const es = new EventSource(url);
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as T;
        setSnapshot(data);
      } catch {
        // JSON parse error → ignorar este mensaje. El siguiente
        // tick traerá un payload nuevo.
      }
    };

    es.addEventListener(eventName, handler);
    return () => {
      es.removeEventListener(eventName, handler);
      es.close();
    };
  }, [url, eventName]);

  return snapshot;
}
