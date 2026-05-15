import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy.
 *
 * - `default-src 'self'` cierra todo y abrimos solo lo necesario.
 * - `script-src` con `'unsafe-inline'` y `'unsafe-eval'` solo en dev
 *   porque Next inyecta hot-reload + React DevTools por esa vía. En
 *   prod queda solo `'self'`, y los scripts de Next (chunks) entran
 *   por el mismo origen.
 * - `img-src`: `data:` para SVG inline + el bucket de api-football
 *   para logos de teams + Google avatars (`*.googleusercontent.com`).
 * - `connect-src`: api-football se ataca server-side, no desde el
 *   cliente, pero lo dejamos por si el cliente lo llama directo más
 *   adelante.
 * - `frame-ancestors 'none'` impide que la app se embeba en iframes
 *   externos (clickjacking).
 *
 * Empezamos en **enforcing** desde el principio porque la app aún
 * es pequeña; si rompe algo, se itera. Si fuese una migración de
 * app con tráfico real, empezaríamos en `Report-Only`.
 */
function buildCsp(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": isProd
      ? ["'self'"]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "style-src": ["'self'", "'unsafe-inline'"],
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

export default withNextIntl(config);
