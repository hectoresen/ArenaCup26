/**
 * Sentry — client (browser).
 *
 * Captura errores no-handled en componentes cliente. NO incluimos
 * Replay ni Feedback (privacidad + coste) — la deuda está apuntada
 * para evaluar cuando empiece tráfico real.
 *
 * `instrumentation-client.ts` (en raíz) es la convención Next 15
 * para inyectar código que corre antes del primer render del
 * cliente; reemplaza al viejo `sentry.client.config.ts`.
 */

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
  // Sampling 100% mientras iteramos.
  tracesSampleRate: 1.0,
  // PII off por defecto.
  sendDefaultPii: false,
});

// Instrumenta navegaciones del App Router para tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
