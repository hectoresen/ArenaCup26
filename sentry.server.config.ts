/**
 * Sentry — server runtime (Node.js).
 *
 * Captura excepciones de Server Components, server actions, route
 * handlers y cron handlers. Se carga vía `src/instrumentation.ts`.
 *
 * **Modo noop**: si `SENTRY_DSN` no está set, `init` se llama con
 * `dsn: undefined` y los `captureException` se vuelven no-ops. Útil
 * para dev local y para que el deploy no falle si Sentry todavía
 * no está configurado.
 */

import { scrubPiiBeforeSend } from "@/lib/sentry-scrub";
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN;
const ENV = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV;
const RELEASE = process.env.RAILWAY_DEPLOYMENT_ID;

Sentry.init({
  dsn: DSN,
  environment: ENV,
  release: RELEASE,
  // Sampling: 100% en dev (queremos ver todo mientras iteramos),
  // 10% en prod cuando haya tráfico real (controlar coste de plan
  // Sentry free: 5k events/mes). Por ahora la app no tiene tráfico
  // así que dejamos 100% también en prod.
  tracesSampleRate: 1.0,
  // No enviamos headers ni IP del user al servidor por default,
  // sí lo encendemos cuando hagamos un user-context explícito.
  sendDefaultPii: false,
  beforeSend: scrubPiiBeforeSend,
});
