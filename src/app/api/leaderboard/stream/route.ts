import { db } from "@/server/db/client";
import { getRealSnapshot } from "@/lib/leaderboard/real";

// Force Node runtime — SSE necesita streaming response que el edge
// runtime maneja distinto. Con Node + Railway funciona out-of-the-box.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICK_MS = 15_000;
const HEARTBEAT_MS = 30_000;
// Tope conservador para evitar conexiones zombies en Railway. Tras
// 5 min el cliente reconectará automáticamente (EventSource lo hace
// solo).
const MAX_DURATION_MS = 5 * 60_000;

/**
 * SSE stream del ranking público. Cada `TICK_MS` (15s) emite el
 * snapshot actual del leaderboard como evento `snapshot`. Cada
 * `HEARTBEAT_MS` (30s) emite un comentario `:hb` para mantener viva
 * la conexión a través de proxies que cierran idle.
 *
 * El payload es el mismo `LeaderboardSnapshot` que renderiza la
 * landing SSR — el cliente puede sustituir el state inicial sin
 * refresh.
 *
 * Limitación deliberada (MVP): el push es periódico, no event-driven.
 * Una mejora futura sería notificar solo cuando se inserta/actualiza
 * un `point_event`, vía Redis pub/sub o un bus en-process.
 */
export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const startedAt = Date.now();
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      const sendHeartbeat = () => {
        if (closed) return;
        controller.enqueue(encoder.encode(`:hb\n\n`));
      };

      const sendSnapshot = async () => {
        try {
          const snapshot = await getRealSnapshot(db);
          send("snapshot", snapshot);
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : String(err) });
        }
      };

      // Snapshot inicial inmediato + ticks periódicos.
      await sendSnapshot();

      const tickInterval = setInterval(sendSnapshot, TICK_MS);
      const hbInterval = setInterval(sendHeartbeat, HEARTBEAT_MS);

      const maxDuration = setTimeout(() => {
        closed = true;
        clearInterval(tickInterval);
        clearInterval(hbInterval);
        controller.close();
      }, MAX_DURATION_MS);

      // Cleanup si el cliente cierra antes del max duration.
      // Node ReadableStream no tiene un `oncancel` directo; usamos el
      // controller.signal vía el request si está disponible. Fallback:
      // los intervals se autodestruyen tras MAX_DURATION_MS.
      controller.error = (err) => {
        closed = true;
        clearInterval(tickInterval);
        clearInterval(hbInterval);
        clearTimeout(maxDuration);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
