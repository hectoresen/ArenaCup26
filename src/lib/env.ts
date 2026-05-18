import { z } from "zod";

const baseSchema = z.object({
  // Auth.js v5
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),

  // Database
  DATABASE_URL: z.string().url(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // API-Football (primary match-data provider). Optional en dev: si no
  // está, el adapter cae con mensaje claro al intentar usarse. La app
  // sin esta variable arranca igual (la home pública no consume API).
  API_FOOTBALL_KEY: z.string().optional(),
  API_FOOTBALL_BASE_URL: z.string().url().default("https://v3.football.api-sports.io"),

  // Match-data pipeline
  // Cron secret para autenticar invocaciones al endpoint de sync. Required en
  // producción; opcional en dev para invocar el endpoint manualmente sin auth.
  CRON_SECRET: z.string().optional(),
  // Modo de sincronización:
  //  - "date-window" (default): trae fixtures de los últimos N días + próximos
  //     M días vía `?date=YYYY-MM-DD`. Funciona en el free tier para seasons
  //     en curso. Ver MATCH_DATA_BEFORE_DAYS y MATCH_DATA_AFTER_DAYS.
  //  - "season": filtra por liga+temporada (`?league=X&season=Y`). Solo
  //     funciona en el free tier para seasons 2022-2024 o con plan pago.
  //     Pensado para cuando llegue el Mundial 2026 y haya plan Pro.
  MATCH_DATA_MODE: z.enum(["date-window", "season"]).default("date-window"),
  // date-window mode. El free tier de api-football solo permite ?date=
  // dentro de una ventana estrecha alrededor de hoy (típicamente hoy ±1
  // día). Por defecto pedimos esa misma ventana mínima; el provider
  // tolera plan_limited por día concreto y continúa con el resto.
  // Con plan Pro se puede subir AFTER_DAYS para tener más predicciones
  // por adelantado.
  MATCH_DATA_BEFORE_DAYS: z.coerce.number().int().nonnegative().default(1),
  MATCH_DATA_AFTER_DAYS: z.coerce.number().int().nonnegative().default(1),
  // CSV de IDs de liga para filtrar localmente en date-window mode. Vacío =
  // todas las ligas que aparezcan en el rango. Ej: "140,253,71" para La Liga,
  // MLS y Brasileirão.
  MATCH_DATA_LEAGUE_FILTER: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0)
        : [],
    ),
  // season mode (también queda como default para "no romper docs")
  MATCH_DATA_LEAGUE_ID: z.coerce.number().int().positive().default(1),
  MATCH_DATA_SEASON: z.coerce.number().int().positive().default(2026),

  // Rate limiting (add-rate-limiting, 2026-05-15). Opcionales: si
  // no están, los limiters son noop. En producción el módulo emite
  // warning al arrancar para que no pase desapercibido.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Sentry (add-error-monitoring, 2026-05-15). Todos opcionales:
  // sin DSN, Sentry queda en modo noop. AUTH_TOKEN solo se usa
  // durante build para subir sourcemaps (si no está, build sigue
  // sin error pero los stack traces de producción no se traducen).
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Plausible (add-product-analytics, 2026-05-15). Opcional. Si no
  // está set, el script no se inyecta — analytics queda en noop.
  // Plausible es privacy-friendly (sin cookies, sin PII), por eso
  // no requiere banner de consentimiento bajo RGPD/ePrivacy. Doc:
  // `docs/security.md §9.3`.
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL: z
    .string()
    .url()
    .default("https://plausible.io/js/script.outbound-links.js"),

  // Web Push (add-web-push-notifications, 2026-05-15). Opcionales.
  // Sin VAPID keys, los endpoints de suscripción devuelven
  // `not_configured` y el banner no se muestra. Pasos para generar
  // en `docs/security.md §9.5`.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  // Subject identifies WHO operates the push service to providers
  // (Mozilla/Apple/FCM) — necesario para que acepten los pushes. Va
  // como `mailto:contact@arenacup26.com` en Railway desde 2026-05-18.
  // Sin esta var, el push system queda en noop (ver `getPushClient`).
  VAPID_SUBJECT: z.string().optional(),

  // Runtime
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Refinements adicionales que solo aplican en producción **runtime**.
 *
 * En dev/test dejamos `CRON_SECRET` opcional para poder lanzar el
 * endpoint a mano con curl sin auth. En runtime de producción
 * exigimos que esté set y con longitud mínima — sin esto,
 * `handleCronRequest` aceptaría cualquier POST.
 *
 * Importante: `next build` corre con `NODE_ENV=production` pero
 * **sin** las env vars de producción cargadas (Railway las inyecta
 * solo en runtime, no en build). Si validáramos ahí, el build
 * local falla espuriosamente. Detectamos build phase con
 * `NEXT_PHASE === "phase-production-build"` y skipeamos.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const schema = baseSchema.superRefine((data, ctx) => {
  if (data.NODE_ENV === "production" && !isBuildPhase) {
    if (!data.CRON_SECRET || data.CRON_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CRON_SECRET"],
        message:
          "CRON_SECRET is required in production and must be ≥32 chars. " +
          "Generate one with `openssl rand -base64 32`.",
      });
    }
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:\n", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
export type Env = z.infer<typeof baseSchema>;
