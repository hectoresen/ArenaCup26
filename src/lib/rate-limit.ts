import { Ratelimit } from "@upstash/ratelimit";
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
 * Rate limiting con Upstash. Defendemos los puntos donde un atacante
 * o bot podría hacer daño con poco esfuerzo:
 *
 *  - `submitPredictionLimiter`: 10 submits / 60s por userId. Un user
 *    legítimo predice una decena de partidos seguidos como mucho.
 *  - `cronLimiter`: 6 req / 60s por IP. Defensa frente a un atacante
 *    que descubre la URL del cron y la spamea antes de pasar el
 *    bearer. El propio bearer es la primera defensa; esto es la
 *    segunda.
 *  - `publicReadLimiter`: 60 req / 60s por IP para `/` y
 *    `/u/<username>`. Permite ráfagas humanas sin penalizar pero
 *    corta scrapers.
 *  - `signupLimiter`: 5 signups / hora por IP. Auth.js callback
 *    Google es el único path donde se crean rows nuevos en `users`.
 *
 * **Modo noop**: si `UPSTASH_REDIS_REST_URL` o `..._TOKEN` no están
 * set, los limiters siempre devuelven `success: true`. Útil para dev
 * local sin Upstash y para que el deploy no falle si la BD Redis no
 * está aún configurada en Railway. En producción dejarlo así sería
 * NO tener rate limiting — el deploy log lo avisa con un warning.
 */

type LimiterConfig = {
  name: "submit" | "cron" | "publicRead" | "signup";
  /** "10 r/60 s" expresado como tuple [count, window]. */
  limit: number;
  windowSec: number;
};

const CONFIGS: LimiterConfig[] = [
  { name: "submit", limit: 10, windowSec: 60 },
  { name: "cron", limit: 6, windowSec: 60 },
  { name: "publicRead", limit: 60, windowSec: 60 },
  { name: "signup", limit: 5, windowSec: 3600 },
];

const isEnabled = Boolean(REDIS_URL) && Boolean(REDIS_TOKEN);

if (!isEnabled && NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.warn(
    "[WM/ratelimit] UPSTASH_REDIS_REST_URL / TOKEN not set in production — rate limiting is DISABLED",
  );
}

const redis = isEnabled
  ? new Redis({
      url: REDIS_URL ?? "",
      token: REDIS_TOKEN ?? "",
    })
  : null;

function buildLimiter(config: LimiterConfig): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSec} s`),
    prefix: `wm:rl:${config.name}`,
    analytics: false,
  });
}

const submitInstance = buildLimiter(CONFIGS[0]!);
const cronInstance = buildLimiter(CONFIGS[1]!);
const publicReadInstance = buildLimiter(CONFIGS[2]!);
const signupInstance = buildLimiter(CONFIGS[3]!);

export type RateLimitResult = {
  ok: boolean;
  /** Cuántos quedan en la ventana actual. */
  remaining: number;
  /** Cuándo se resetea la ventana (timestamp ms). */
  reset: number;
};

/**
 * Comprueba un limiter contra un identificador. Si los limiters están
 * deshabilitados (noop), siempre devuelve `ok: true` con números
 * placeholder.
 */
async function check(
  instance: Ratelimit | null,
  scope: LimiterConfig["name"],
  identifier: string,
): Promise<RateLimitResult> {
  if (!instance) {
    return { ok: true, remaining: 999, reset: 0 };
  }
  try {
    const result = await instance.limit(identifier);
    if (!result.success) {
      // Solo loggeamos cuando se rechaza — un permitido no es
      // interesante. Truncamos el identifier para no exponer IPs/IDs
      // completos en los logs persistentes.
      dlog("ranking", "rate_limited", {
        scope,
        id: identifier.slice(0, 8),
        reset: result.reset,
      });
    }
    return {
      ok: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    // Si Redis falla (latencia / down), preferimos no bloquear al
    // usuario legítimo. Log y permitir. Esto se invierte cuando
    // tengamos métricas de abuso real.
    dlog("ranking", "rate_limit_check_failed", {
      scope,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: true, remaining: 0, reset: 0 };
  }
}

export async function checkSubmitLimit(userId: string): Promise<RateLimitResult> {
  return check(submitInstance, "submit", userId);
}

export async function checkCronLimit(ip: string): Promise<RateLimitResult> {
  return check(cronInstance, "cron", ip);
}

export async function checkPublicReadLimit(ip: string): Promise<RateLimitResult> {
  return check(publicReadInstance, "publicRead", ip);
}

export async function checkSignupLimit(ip: string): Promise<RateLimitResult> {
  return check(signupInstance, "signup", ip);
}

/** Pura, para tests. Indica si la integración con Upstash está activa. */
export function isRateLimitEnabled(): boolean {
  return isEnabled;
}
