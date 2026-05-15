import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy.
 *
 * - `default-src 'self'` cierra todo y abrimos solo lo necesario.
 * - `script-src` necesita `'unsafe-inline'` mientras no migremos a
 *   CSP con nonces. Next 15 inyecta scripts inline (hidratación
 *   de RSC, streaming, intl bootstrap, etc.) que se rompen sin
 *   `'unsafe-inline'` y dejan la web en negro. Para volver a una
 *   CSP estricta (`'strict-dynamic'` + nonce por request), ver
 *   TODO en `docs/security.md` §8.2 WEAK-6.
 * - `style-src` también admite inline porque Tailwind 4 lo emite.
 *   `style-src-elem` se especifica explícito para evitar el
 *   fallback ambiguo de Chrome.
 * - `img-src`: `data:` para SVG inline + media.api-sports.io
 *   (logos de teams) + Google avatars.
 * - `connect-src`: api-football se ataca server-side pero lo
 *   permitimos por si el cliente lo llama directo más adelante.
 * - `frame-ancestors 'none'` impide embebido en iframes externos.
 *
 * Empezamos en enforcing desde el primer deploy. Si rompe algo,
 * se itera: el 2026-05-15 tuvimos que añadir `'unsafe-inline'` a
 * `script-src` en prod porque Next 15 lo necesita.
 */
function buildCsp(): string {
  // Mientras no haya soporte de nonce en next-intl + Tailwind 4,
  // `'unsafe-inline'` es obligatorio en script-src y style-src. La
  // protección XSS recae principalmente en el escaping de React
  // (que sigue activo) y en `frame-ancestors 'none'` que evita
  // clickjacking. La deuda está registrada como WEAK-6 en el audit.
  const inlineScript = ["'self'", "'unsafe-inline'"];
  const inlineStyle = ["'self'", "'unsafe-inline'"];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": isProd ? inlineScript : [...inlineScript, "'unsafe-eval'"],
    "script-src-elem": inlineScript,
    "style-src": inlineStyle,
    "style-src-elem": inlineStyle,
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://media.api-sports.io",
      "https://*.googleusercontent.com",
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", "https://v3.football.api-sports.io"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

const securityHeaders: Array<{ key: string; value: string }> = [
  { key: "Content-Security-Policy", value: buildCsp() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), camera=(), payment=()",
  },
];

if (isProd) {
  // HSTS: una vez served sobre HTTPS, el browser fuerza HTTPS las
  // siguientes visitas (2 años + subdomains + preload-ready).
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const config: NextConfig = {
  // Promovido fuera de `experimental` en Next 15.5+
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

/**
 * Composición de wrappers:
 *   next-intl (i18n) → Sentry (instrumentation + sourcemaps).
 *
 * Sentry solo se activa cuando `SENTRY_DSN` y `SENTRY_AUTH_TOKEN`
 * están configurados. Sin las env vars, `withSentryConfig` deja
 * pasar la config sin tocar nada (no requiere upload de sourcemaps).
 *
 * `org` y `project` son slugs públicos de Sentry — no son secrets.
 * Quedan hardcoded para evitar otra env var; cuando alguien forkee
 * el repo, los cambia o configura los suyos.
 */
const SENTRY_ORG = "webmundial-26";
const SENTRY_PROJECT = "webmundial";

const nextIntlConfig = withNextIntl(config);

export default withSentryConfig(nextIntlConfig, {
  org: SENTRY_ORG,
  project: SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Mantén silencioso el build cuando no haya auth token o no
  // queramos sourcemap upload (e.g. local).
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // No subir sourcemaps si no hay auth token — evita ruido en CI.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // No expone Sentry como dep del cliente bundle si no se usa.
  disableLogger: true,
});
