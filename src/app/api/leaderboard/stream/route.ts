import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getRealSnapshot, getRealSnapshotForUser } from "@/lib/leaderboard/real";
import { getLastRankingChange, isRankingEventsEnabled } from "@/lib/redis/ranking-events";

// Force Node runtime — SSE necesita streaming response que el edge
// runtime maneja distinto. Con Node + Railway funciona out-of-the-box.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Polling rápido del pointer de Redis para detectar cambios en
// `user_points`. 1 GET/s/conexión es trivial (Upstash facturad por
// MB de payload, no por request hasta planes free + pay-as-you-go).
const POLL_MS = 1_000;
// Tick periódico de fallback: si Upstash falla o no está configurado,
// seguimos emitiendo snapshots cada 15 s para no quedar mudos. Misma
// cadencia que el comportamiento previo a pub/sub.
const FALLBACK_TICK_MS = 15_000;
const HEARTBEAT_MS = 30_000;
// Tope para evitar conexiones zombies en Railway. Al alcanzarlo
// enviamos un evento `bye` y el CLIENTE cierra su EventSource para
// luego reabrir uno nuevo (el server NO hace controller.close — eso
// causaría `ERR_CONNECTION_RESET` en consola del browser aunque
// EventSource reconectase solo). 30 min equilibra: poco ruido y los
// intervalos del server no se acumulan indefinidamente si el cliente
// se desconecta de forma silenciosa (red móvil, suspend del tab).
const MAX_DURATION_MS = 30 * 60_000;

/**
 * SSE stream del ranking público. Emite eventos `snapshot` con el
 * shape `{ players, generatedAt, myRank }`.
 *
 * **Mecanismo event-driven** (desde 2026-05-18 vía Redis):
 *  - Cada `POLL_MS` (1 s) lee el pointer
 *    `arenacup26:ranking:last-changed` desde Upstash. Si su valor es
 *    posterior al último emit, dispara un snapshot inmediato.
 *  - Como fallback, cada `FALLBACK_TICK_MS` (15 s) emitimos un
 *    snapshot aunque el pointer no haya cambiado. Cubre dos casos:
 *      (a) Upstash no configurado (sin Redis vars) → polling es no-op.
 *      (b) Cambio se escribió pero por algún motivo no se publicó
 *          (best-effort en el publisher). 15 s peor caso.
 *  - `:hb` cada `HEARTBEAT_MS` para mantener viva la conexión a
 *    través de proxies que cierran idle.
 *
 * `myRank` es la posición real del viewer logado (1-based) o `null`
 * si está sin sesión. Permite a `/inicio` actualizar el "#N" de "Mi
 * posición" en vivo aunque el viewer esté fuera del top 100.
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
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let fallbackInterval: ReturnType<typeof setInterval> | null = null;
  let hbInterval: ReturnType<typeof setInterval> | null = null;
  let maxDuration: ReturnType<typeof setTimeout> | null = null;
  // Último timestamp que vimos en el pointer de Redis. Si el pointer
  // viene con valor mayor, sabemos que hubo cambio entre polls.
  let lastSeenChange = 0;
  // Timestamp del último snapshot que emitimos. El fallback emite si
  // pasaron 15 s desde aquí (no desde el último poll-trigger).
  let lastEmittedAt = 0;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (pollInterval) clearInterval(pollInterval);
    if (fallbackInterval) clearInterval(fallbackInterval);
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
          lastEmittedAt = Date.now();
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : String(err) });
        }
      };

      // Snapshot inicial inmediato (cubre el primer paint del cliente).
      await sendSnapshot();

      // Polling del pointer Redis: 1 s. Si el last-changed es más nuevo
      // que el último que vimos, emitimos snapshot en caliente.
      // Sin Redis configurado, `getLastRankingChange` devuelve null →
      // este polling es no-op y el fallback de 15 s se encarga.
      if (isRankingEventsEnabled()) {
        pollInterval = setInterval(async () => {
          if (closed) return;
          const lastChange = await getLastRankingChange();
          if (lastChange !== null && lastChange > lastSeenChange) {
            lastSeenChange = lastChange;
            await sendSnapshot();
          }
        }, POLL_MS);
      }

      // Tick fallback: emitir snapshot si pasaron 15 s desde el último
      // emit (incluyendo los triggered por poll). Garantiza que ningún
      // cliente quede sin update aunque Redis esté caído o la app
      // tenga un período de inactividad sin publishes.
      fallbackInterval = setInterval(() => {
        if (closed) return;
        if (Date.now() - lastEmittedAt >= FALLBACK_TICK_MS) {
          void sendSnapshot();
        }
      }, FALLBACK_TICK_MS);

      hbInterval = setInterval(sendHeartbeat, HEARTBEAT_MS);

      maxDuration = setTimeout(() => {
        // Cierre limpio en dos fases para evitar `ERR_CONNECTION_RESET`
        // en consola del cliente:
        //  1. Enviamos evento `bye` — el cliente lo escucha y llama
        //     `es.close()` por su cuenta. Cierre iniciado por el cliente
        //     es silencioso (no genera RST_STREAM visible).
        //  2. Damos 5 s de gracia para que el browser procese el evento
        //     y el TCP se cierre desde el cliente. Si transcurridos esos
        //     5 s el cliente sigue conectado (ignoró `bye`), forzamos
        //     `controller.close()` desde server.
        try {
          safeEnqueue(`event: bye\ndata: {"reason":"max_duration"}\n\n`);
        } catch {
          // controller ya cerrado por cancel — no-op.
        }
        // El cliente honraría el `bye` cerrando él mismo. Cuando
        // `req.signal` aborte, `cleanup()` se dispara y los intervals
        // se limpian. Si no honra (cliente viejo o roto), forzamos
        // close server-side tras la ventana de gracia.
        setTimeout(() => {
          cleanup();
          try {
            controller.close();
          } catch {
            // Ya cerrado por cancel; no-op.
          }
        }, 5_000);
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
