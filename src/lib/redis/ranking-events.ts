import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Canal lógico de eventos del ranking. Patrón **last-change pointer**:
 *
 *  - **Publisher** (`processFinishedMatch`, `snapshot-ranking`): cada
 *    vez que `user_points` cambia globalmente, escribe el timestamp
 *    actual en `arenacup26:ranking:last-changed`.
 *  - **Subscriber** (SSE `/api/leaderboard/stream`): polla esta clave
 *    cada 1s y, si su valor es más nuevo que el último emit, dispara
 *    un snapshot inmediato a los clientes conectados.
 *
 * No usamos `PUBLISH/SUBSCRIBE` clásico porque Upstash REST no soporta
 * suscripciones persistentes via HTTP. El polling de una sola clave
 * es barato (~1 GET/s/conexión = trivial) y consigue latencia
 * sub-segundo entre "BD actualizada" y "UI actualizada".
 *
 * Si Upstash no está configurado (sin keys), `publish` es no-op y
 * `getLast` devuelve `null` — el SSE cae al modo polling clásico de 15s
 * automáticamente.
 */

const REDIS_URL = env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = env.UPSTASH_REDIS_REST_TOKEN;
const isEnabled = Boolean(REDIS_URL) && Boolean(REDIS_TOKEN);

const redis = isEnabled
  ? new Redis({
      url: REDIS_URL ?? "",
      token: REDIS_TOKEN ?? "",
    })
  : null;

const KEY = "arenacup26:ranking:last-changed";

/**
 * Anuncia que `user_points` ha cambiado. Se llama desde el server al
 * final de cualquier operación que mueva el ranking
 * (`processFinishedMatch`, `payReferralBonusIfFirstHit`,
 * `snapshot-ranking`). Best-effort: si Redis falla, lo ignoramos —
 * el SSE seguirá funcionando con su tick periódico de fallback.
 */
export async function publishRankingChange(): Promise<void> {
  if (!redis) return;
  try {
    // SETEX con TTL 300s para que la key no quede zombie si el
    // service se reinicia y nadie publica durante un rato. 5 min cubre
    // cualquier brecha realista entre publishes en producción.
    await redis.setex(KEY, 300, Date.now());
  } catch {
    // Silencioso. Ver comentario en el módulo: caer al fallback de 15s
    // es aceptable; loggear cada fallo solo añade ruido.
  }
}

/**
 * Devuelve el timestamp del último cambio en ms (epoch). `null` si:
 *  - Upstash no está configurado.
 *  - La key no existe / expiró (TTL 5 min).
 *  - El fetch falla.
 */
export async function getLastRankingChange(): Promise<number | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get<string | number>(KEY);
    if (raw === null || raw === undefined) return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function isRankingEventsEnabled(): boolean {
  return isEnabled;
}
