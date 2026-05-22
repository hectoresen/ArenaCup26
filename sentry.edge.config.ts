/**
 * Sentry — edge runtime (middleware + edge routes).
 *
 * Nuestra app no usa todavía middleware con Sentry pero next-intl
 * sí ejecuta código en Edge, por eso lo dejamos configurado.
 */

import { scrubPiiBeforeSend } from "@/lib/sentry-scrub";
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.RAILWAY_DEPLOYMENT_ID,
  tracesSampleRate: 1.0,
  sendDefaultPii: false,
  beforeSend: scrubPiiBeforeSend,
});
