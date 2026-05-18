import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getRealSnapshot, getRealSnapshotForUser } from "@/lib/leaderboard/real";

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
 * SSE stream del ranking público. Cada `TICK_MS` (15s) emite un evento
 * `snapshot` con el shape:
 *
 *   { players, generatedAt, myRank }
 *
 * Donde `players` es el top TOP_LIMIT global y `myRank` es la
 * posición real del viewer logado (1-based) o `null` si está sin
 * sesión. Esto permite a `/inicio` actualizar el último punto del
 * sparkline + el "#N" de "Mi posición" en vivo, aunque el viewer
 * esté fuera del top 100.
 *
 * `:hb` cada `HEARTBEAT_MS` para mantener viva la conexión a través
 * de proxies que cierran idle.
 *
 * Limitación: push periódico, no event-driven. Mejora futura cuando
 * exista pub/sub Redis o bus en-process.
 */
export async function GET(req: Request) {
  // Resolvemos la sesión UNA VEZ al abrir la conexión. Aceptamos
  // staleness durante la vida del stream (5 min máximo): si el user
  // cierra sesión, sigue recibiendo su myRank hasta reconectar. Es
  // una decisión de simplicidad — el rank no es información sensible.
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  // Estado del stream compartido entre `start` y `cancel`. Cuando el
  // cliente cierra la pestaña, Next.js invoca `cancel` y/o aborta el
  // `req.signal` — ambos paths limpian intervals para evitar el bug
  // `TypeError: Controller is already closed` que floodeaba logs al
  // intentar `enqueue` sobre un controller cerrado.
  let closed = false;
  let tickInterval: ReturnType<typeof setInterval> | null = null;
  let hbInterval: ReturnType<typeof setInterval> | null = null;
  let maxDuration: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (tickInterval) clearInterval(tickInterval);
    if (hbInterval) clearInterval(hbInterval);
    if (maxDuration) clearTimeout(maxDuration);
  };

  // Cliente cierra pestaña/red → AbortSignal. Es complementario a
  // `cancel()` del stream; en algunos runtimes solo dispara uno.
  req.signal.addEventListener("abort", cleanup);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Si el controller ya está cerrado (race condition entre
          // cancel y un tick en vuelo), simplemente paramos.
          cleanup();
        }
      };

      const send = (event: string, data: unknown) => {
        safeEnqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const sendHeartbeat = () => {
        safeEnqueue(`:hb\n\n`);
      };

      const sendSnapshot = async () => {
        if (closed) return;
        try {
          if (viewerId) {
            const { snapshot, myRank } = await getRealSnapshotForUser(db, viewerId);
            send("snapshot", { ...snapshot, myRank });
          } else {
            const snapshot = await getRealSnapshot(db);
            send("snapshot", { ...snapshot, myRank: null });
          }
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : String(err) });
        }
      };

      // Snapshot inicial inmediato + ticks periódicos.
      await sendSnapshot();

      tickInterval = setInterval(sendSnapshot, TICK_MS);
      hbInterval = setInterval(sendHeartbeat, HEARTBEAT_MS);

      maxDuration = setTimeout(() => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Ya cerrado por cancel; no-op.
        }
      }, MAX_DURATION_MS);
    },
    cancel() {
      cleanup();
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
