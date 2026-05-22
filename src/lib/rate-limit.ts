import { dlog } from "@/lib/debug-log";

/**
 * Rate limiting **in-memory** (fixed-window counter por proceso Node).
 *
 * Por qué no Redis: el adapter HTTP de Upstash interno de Railway
 * resultó frágil (cuelgues silenciosos del proxy `*.railway.internal`)
 * y ningún sentido pagar/configurar Upstash Cloud para una app con
 * tráfico bajo. Ver `docs/data-pipeline.md §rate-limit` y el incidente
 * del 2026-05-20 para contexto.
 *
 * Tradeoffs aceptados:
 *  - **Estado por instancia**: si algún día escalas a múltiples
 *    réplicas en Railway, cada una mantiene su propio contador. Límite
 *    efectivo = N × limit por usuario/IP. Para un atacante real eso
 *    sigue siendo un freno; para un user legítimo es transparente.
 *  - **Estado volátil**: en cada deploy/restart el Map se resetea. Un
 *    atacante avispado podría dispararse contra los redeploys. No es
 *    una preocupación a escala actual; si lo fuera, mover a Postgres
 *    es ~50 líneas (tabla `rate_limit_buckets`).
 *
 * Ventajas:
 *  - Latencia: nanosegundos. Cero llamadas de red por request.
 *  - Cero infra externa, cero coste mensual, cero env vars.
 *  - Mismo interface público que el módulo anterior — los callers
 *    (`submitPredictionAction`, crons, `/api/notifications/subscribe`)
 *    no cambian una línea.
 *
 * Defendemos los puntos donde un atacante o bot podría hacer daño:
 *
 *  - `submit`:     10 / 60s    por userId. Predicción legítima ≪ 10/min.
 *  - `cron`:        6 / 60s    por IP. Segunda línea tras el bearer.
 *  - `publicRead`: 60 / 60s    por IP en `/` y `/u/<username>`.
 *  - `signup`:      5 / 3600s  por IP. Anti-creación masiva de cuentas.
 *
 * Implementación: fixed-window counter. Clave
 * `<scope>:<id>:<bucketIndex>`, donde `bucketIndex = floor(now / windowMs)`.
 * Al cambiar de ventana (un segundo después del cierre) la clave anterior
 * queda huérfana en el Map — el `cleanupExpired` (lazy + periódico) la
 * descarta.
 */

type LimiterConfig = {
  name: "submit" | "cron" | "publicRead" | "signup";
  limit: number;
  windowSec: number;
};

const CONFIGS: LimiterConfig[] = [
  { name: "submit", limit: 10, windowSec: 60 },
  { name: "cron", limit: 6, windowSec: 60 },
  { name: "publicRead", limit: 60, windowSec: 60 },
  { name: "signup", limit: 5, windowSec: 3600 },
];

const CONFIG_BY_NAME = new Map(CONFIGS.map((c) => [c.name, c]));

type Bucket = {
  count: number;
  /** Epoch ms en el que la ventana se cierra y la clave es desechable. */
  resetAt: number;
};

/**
 * El store en sí. Es un singleton del módulo — el runtime de Node
 * mantiene el mismo `Map` vivo entre requests dentro del mismo proceso.
 * Cuando Railway reinicia el contenedor (deploy, OOM, etc.) el Map se
 * crea de cero. Aceptable a esta escala.
 */
const store = new Map<string, Bucket>();

/**
 * Guard-rail para que el Map no crezca sin tope si llega tráfico masivo
 * o un bug genera claves únicas. Si alguna vez superamos este número,
 * `check` purga claves caducadas antes de admitir nuevas. En operación
 * normal el Map se mantiene en cientos de entries — los users activos
 * por minuto.
 */
const MAX_BUCKETS = 50_000;

/**
 * Última vez (epoch ms) que hicimos un sweep completo del store. El
 * sweep es O(n) pero solo lo hacemos como mucho cada 60s o cuando
 * superamos el tope. En estado estable nunca se ejecuta — los buckets
 * se crean y se descartan por hash colisional cuando vuelve la misma
 * IP/userId al minuto siguiente.
 */
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

function maybeSweep(now: number) {
  if (store.size < MAX_BUCKETS && now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  let removed = 0;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(key);
      removed++;
    }
  }
  lastSweepAt = now;
  if (removed > 0) {
    dlog("ranking", "rate_limit_sweep", { removed, remaining: store.size });
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Cuántos quedan en la ventana actual. */
  remaining: number;
  /** Timestamp ms aproximado en el que se resetea la ventana. */
  reset: number;
};

/**
 * Core check. Idempotente respecto al store: dos llamadas con el mismo
 * (scope, identifier) dentro de la misma ventana actualizan el mismo
 * bucket.
 *
 * **No** es fail-open en sentido estricto — al ser in-memory no hay
 * "fallo de red" del que protegerse. Si lanza por alguna razón muy
 * inesperada (OOM en el INCR), el caller debería dejar pasar la
 * request; lo gestionamos con try/catch en `check`.
 */
function check(scope: LimiterConfig["name"], identifier: string): RateLimitResult {
  const config = CONFIG_BY_NAME.get(scope);
  if (!config) {
    return { ok: true, remaining: 999, reset: 0 };
  }

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const bucketIndex = Math.floor(now / windowMs);
  const key = `${scope}:${identifier}:${bucketIndex}`;
  const resetAt = (bucketIndex + 1) * windowMs;

  maybeSweep(now);

  try {
    const existing = store.get(key);
    const count = (existing?.count ?? 0) + 1;
    store.set(key, { count, resetAt });

    const ok = count <= config.limit;
    if (!ok) {
      dlog("ranking", "rate_limited", {
        scope,
        id: identifier.slice(0, 8),
        count,
        limit: config.limit,
      });
    }
    return {
      ok,
      remaining: Math.max(0, config.limit - count),
      reset: resetAt,
    };
  } catch (err) {
    // Defensa por si algo del store falla raro (Map agotado por OOM,
    // p.ej.). Fail-open: mejor dejar pasar al user legítimo que cortar.
    dlog("ranking", "rate_limit_check_failed", {
      scope,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: true, remaining: 0, reset: 0 };
  }
}

export function checkSubmitLimit(userId: string): Promise<RateLimitResult> {
  return Promise.resolve(check("submit", userId));
}

export function checkCronLimit(ip: string): Promise<RateLimitResult> {
  return Promise.resolve(check("cron", ip));
}

export function checkPublicReadLimit(ip: string): Promise<RateLimitResult> {
  return Promise.resolve(check("publicRead", ip));
}

export function checkSignupLimit(ip: string): Promise<RateLimitResult> {
  return Promise.resolve(check("signup", ip));
}

/**
 * En la versión Upstash devolvía true/false según hubiera env vars
 * configuradas. Ahora el rate-limit es siempre operativo (in-memory),
 * así que siempre `true`. Lo dejamos exportado para no romper callers.
 */
export function isRateLimitEnabled(): boolean {
  return true;
}

/**
 * Para tests: vacía el store entre suites para evitar leakage de
 * estado. NO exportar fuera de tests — un caller en runtime podría
 * resetear contadores sin querer.
 */
export function __resetRateLimitStoreForTests(): void {
  store.clear();
  lastSweepAt = 0;
}
