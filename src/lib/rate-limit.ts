import { Redis } from "@upstash/redis";
import { dlog } from "@/lib/debug-log";

// Leemos `process.env` directamente en lugar de importar `env` de
// `@/lib/env` para evitar el side-effect de la validación zod cuando
// este módulo se importa desde tests puros (e.g. `handler.test.ts`,
// que no carga AUTH_SECRET / GOOGLE_*). El env de prod sigue
// gobernado por env.ts; aquí solo nos interesa "está set o no".
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const NODE_ENV = process.env.NODE_ENV;

/**
 * Rate limiting "casero" sobre Upstash Redis (o adapter HTTP
 * compatible). No usamos `@upstash/ratelimit` directamente porque
 * ese paquete ejecuta scripts Lua vía `EVALSHA`, y el adapter HTTP
 * que tenemos en Railway (`luggapugga/serverless-redis`) no
 * implementa Lua (responde `NoScript: No matching script`).
 * Implementamos un **fixed window counter** con `INCR` + `EXPIRE`
 * — comandos básicos que cualquier Redis (o adapter HTTP) entiende.
 *
 * Fixed window vs sliding window: fixed es menos preciso (un user
 * puede hacer `limit` requests al final de una ventana + `limit`
 * más al principio de la siguiente). Para nuestros umbrales (10
 * por minuto, 60 por minuto, etc.) es perfectamente suficiente y
 * no vamos a ver burst-abuse a esa escala temporal.
 *
 * Defendemos los puntos donde un atacante o bot podría hacer daño:
 *
 *  - `submit`:     10 / 60s    por userId. Predicción legítima ≪ 10/min.
 *  - `cron`:        6 / 60s    por IP. Segunda línea tras el bearer.
 *  - `publicRead`: 60 / 60s    por IP en `/` y `/u/<username>`.
 *  - `signup`:      5 / 3600s  por IP. Anti-creación masiva de cuentas.
 *
 * **Modo noop**: si `UPSTASH_REDIS_REST_URL` o `..._TOKEN` no están
 * set, los checks siempre devuelven `ok: true`. Útil para dev local
 * sin Redis y para que el deploy no falle si la BD no está aún
 * configurada. En producción el módulo emite warning al arrancar.
 *
 * **Política fail-open**: si Redis falla por cualquier motivo, el
 * check permite la request. Mejor abuso temporal que cortar a un
 * usuario legítimo por un problema de infra interna.
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

const isEnabled = Boolean(REDIS_URL) && Boolean(REDIS_TOKEN);

if (!isEnabled && NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.warn(
    "[AC/ratelimit] UPSTASH_REDIS_REST_URL / TOKEN not set in production — rate limiting is DISABLED",
  );
}

const redis = isEnabled
  ? new Redis({
      url: REDIS_URL ?? "",
      token: REDIS_TOKEN ?? "",
    })
  : null;

export type RateLimitResult = {
  ok: boolean;
  /** Cuántos quedan en la ventana actual. */
  remaining: number;
  /** Timestamp ms aproximado en el que se resetea la ventana. */
  reset: number;
};

/**
 * Fixed window counter: clave `wm:rl:<scope>:<id>:<bucketEpoch>`.
 * En el primer hit del bucket hace `INCR` (→1) y `EXPIRE` con el
 * tamaño exacto de la ventana, así la clave se autodestruye cuando
 * cierra. Re-hits incrementan sin tocar el TTL.
 */
async function check(
  scope: LimiterConfig["name"],
  identifier: string,
): Promise<RateLimitResult> {
  if (!redis) {
    return { ok: true, remaining: 999, reset: 0 };
  }
  const config = CONFIG_BY_NAME.get(scope);
  if (!config) {
    return { ok: true, remaining: 999, reset: 0 };
  }

  const now = Date.now();
  const bucketIndex = Math.floor(now / (config.windowSec * 1000));
  const key = `wm:rl:${scope}:${identifier}:${bucketIndex}`;
  const bucketEnd = (bucketIndex + 1) * config.windowSec * 1000;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // Primera vez en este bucket → fijar TTL al cierre de la
      // ventana. Re-hits no tocan el TTL (clave se autodestruye).
      await redis.expire(key, config.windowSec);
    }
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
      reset: bucketEnd,
    };
  } catch (err) {
    dlog("ranking", "rate_limit_check_failed", {
      scope,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: true, remaining: 0, reset: 0 };
  }
}

export async function checkSubmitLimit(userId: string): Promise<RateLimitResult> {
  return check("submit", userId);
}

export async function checkCronLimit(ip: string): Promise<RateLimitResult> {
  return check("cron", ip);
}

export async function checkPublicReadLimit(ip: string): Promise<RateLimitResult> {
  return check("publicRead", ip);
}

export async function checkSignupLimit(ip: string): Promise<RateLimitResult> {
  return check("signup", ip);
}

/** Pura, para tests. Indica si la integración con Upstash está activa. */
export function isRateLimitEnabled(): boolean {
  return isEnabled;
}
