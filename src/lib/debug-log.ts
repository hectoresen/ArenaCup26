/**
 * Logger compartido para trazar el pipeline durante el sprint de
 * validación end-to-end con datos reales. Todas las trazas comparten
 * el prefijo `[WM]` para filtrar en Railway:
 *
 *   railway logs --service web | grep '\[WM/'
 *
 * Una vez validado el flujo en producción, los `dlog(...)` se retiran
 * y dejamos solo errores/warns esenciales. Mientras tanto, son
 * verbosos a propósito.
 */

type Scope =
  | "cron"
  | "sync"
  | "reconcile"
  | "scoring"
  | "predict"
  | "ranking"
  | "notify";

/**
 * Loguea un evento del pipeline. El payload se serializa con JSON.stringify
 * "compacto" para que sea grep-able. Si `data` es undefined, solo prefijo.
 */
export function dlog(scope: Scope, message: string, data?: unknown): void {
  const prefix = `[WM/${scope}]`;
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
 */
export function derr(scope: Scope, message: string, err: unknown): void {
  const prefix = `[WM/${scope}]`;
  if (err instanceof Error) {
    console.error(`${prefix} ${message}: ${err.message}`, err.stack);
  } else {
    console.error(`${prefix} ${message}:`, err);
  }
}
