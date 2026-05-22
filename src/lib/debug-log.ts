/**
 * Logger compartido para trazar el pipeline durante el sprint de
 * validación end-to-end con datos reales. Todas las trazas comparten
 * el prefijo `[AC]` (ArenaCup26) para filtrar en Railway:
 *
 *   railway logs --service web | grep '\[AC/'
 *
 * Una vez validado el flujo en producción, los `dlog(...)` se retiran
 * y dejamos solo errores/warns esenciales. Mientras tanto, son
 * verbosos a propósito.
 */

type Scope = "cron" | "sync" | "reconcile" | "scoring" | "predict" | "ranking" | "notify" | "push";

/**
 * Loguea un evento del pipeline. El payload se serializa con JSON.stringify
 * "compacto" para que sea grep-able. Si `data` es undefined, solo prefijo.
 */
export function dlog(scope: Scope, message: string, data?: unknown): void {
  const prefix = `[AC/${scope}]`;
  if (data === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }
  // Serializamos defensivamente; si algo no es serializable, dejamos el toString.
  let payload: string;
  try {
    payload = JSON.stringify(data);
  } catch {
    payload = String(data);
  }
  console.log(`${prefix} ${message} ${payload}`);
}

/**
 * Loguea un error con stack si está disponible. Mismo prefijo para que
 * un único grep capture toda la traza del pipeline.
 *
 * En producción además captura el error en Sentry (si SENTRY_DSN está
 * configurado). El import dinámico evita cargar el SDK en tests que
 * no levantan entorno completo y permite que el módulo siga siendo
 * tree-shakeable en el cliente.
 */
export function derr(scope: Scope, message: string, err: unknown): void {
  const prefix = `[AC/${scope}]`;
  if (err instanceof Error) {
    console.error(`${prefix} ${message}: ${err.message}`, err.stack);
  } else {
    console.error(`${prefix} ${message}:`, err);
  }

  // Envío a Sentry — solo en producción y solo si Sentry tiene DSN
  // configurado. Si no hay DSN, `captureException` es no-op pero el
  // import del módulo sigue pesando ~50KB. Mejor evitarlo en dev.
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.SENTRY_DSN) return;
  // Import dinámico: el SDK se carga lazy. Cualquier fallo aquí se
  // come en silencio para no enmascarar el error original.
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(err, {
        tags: { scope },
        extra: { message },
      });
    })
    .catch(() => {
      // ignore — Sentry no debería caerse del pipeline crítico
    });
}
