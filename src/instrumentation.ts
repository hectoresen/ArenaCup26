import * as Sentry from "@sentry/nextjs";

/**
 * Bridge de instrumentation de Next 15: importa el config correcto
 * según el runtime activo (Node.js para server-side, Edge para
 * middleware + edge routes).
 *
 * El cliente (browser) NO se carga aquí — eso lo hace
 * `instrumentation-client.ts` en la raíz, según la convención
 * Next 15.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // Arranca el scheduler interno (live-scoring + kickoff reminders)
    // — independiente del cron HTTP de GitHub Actions, que sufre
    // throttling severo en el free tier (intervalos reales de hasta
    // 1h vs el `*/2 * * * *` configurado). Ver
    // `src/server/cron/in-process-scheduler.ts` para el rationale.
    const { startInProcessScheduler } = await import(
      "./server/cron/in-process-scheduler"
    );
    startInProcessScheduler();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Captura errores que surgen de Server Components, middleware o
 * route handlers que Next no propaga al runtime de cliente. Sentry
 * los persiste como `request_error`.
 */
export const onRequestError = Sentry.captureRequestError;
