import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getRealSnapshot, getRealSnapshotForUser } from "@/lib/leaderboard/real";

// Force Node runtime — SSE necesita streaming response que el edge
// runtime maneja distinto. Con Node + Railway funciona out-of-the-box.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cadencia única de snapshots: cada 15 s emitimos un refresh a todos
// los clientes conectados. Suficiente para el requisito de "ranking
// en vivo" del producto. Antes existía un pointer en Redis para
// activar snapshots inmediatos (~1s) tras cada cambio en
// `user_points`, pero se eliminó cuando el rate-limit migró a
// in-memory — ya no había razón para mantener Upstash en
// infraestructura.
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
 * **Mecanismo**:
 *  - Snapshot inicial al conectar (cubre el primer paint del cliente).
 *  - `FALLBACK_TICK_MS` (15 s): emite un nuevo snapshot a todos los
 *    clientes. Suficiente para el requisito de "ranking en vivo".
 *  - `:hb` cada `HEARTBEAT_MS` (30 s) para mantener viva la conexión
 *    a través de proxies que cierran idle connections.
 *  - `event: bye` cuando alcanzamos `MAX_DURATION_MS` (30 min); el
 *    cliente lo recibe y reabre la conexión limpiamente.
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
  let fallbackInterval: ReturnType<typeof setInterval> | null = null;
  let hbInterval: ReturnType<typeof setInterval> | null = null;
  let maxDuration: ReturnType<typeof setTimeout> | null = null;
  // Timestamp del último snapshot que emitimos — el tick fallback solo
  // emite si han pasado ≥ `FALLBACK_TICK_MS` desde aquí, lo que evita
  // re-enviar dos snapshots seguidos cuando el inicial coincide con
  // el primer tick del interval.
  let lastEmittedAt = 0;

  const cleanup = () => {
    if (closed) return;
    closed = true;
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

      // Tick periódico: emitir snapshot cada 15 s. Mantenemos la guarda
      // de `lastEmittedAt` para que, si en el futuro alguien añade
      // disparadores extra (sub-segundo via push), no encolemos dos
      // snapshots en milisegundos.
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
