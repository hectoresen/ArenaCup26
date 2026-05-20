/**
 * Envoltorio de timeout para promesas que dependen de I/O lento o
 * inestable — típicamente llamadas al adapter HTTP de Upstash Redis.
 *
 * Por qué hace falta este helper:
 *
 * El adapter `@upstash/redis` hace fetch HTTP por debajo. Cuando el
 * host destino acepta la conexión TCP pero NO envía respuesta
 * (degradación silenciosa del proxy, DNS interno en transición),
 * `fetch` queda esperando sin lanzar excepción ni honrar timeout
 * por defecto. Cualquier `await redis.X()` se cuelga **infinitamente**.
 *
 * Incidente que motivó este helper (2026-05-20): el host
 * `*.railway.internal` apuntado en `UPSTASH_REDIS_REST_URL` dejó de
 * responder. `checkSubmitLimit` (rate-limit del submit de predicciones)
 * llamaba a `redis.incr()` y nunca devolvía → la server action
 * `submitPredictionAction` quedaba colgada → el usuario veía
 * "Guardando..." indefinidamente.
 *
 * Solución: `Promise.race` contra un setTimeout que rechaza la promesa
 * tras `ms`. El caller envuelve cada llamada Redis y, si falla por
 * timeout, aplica fail-open (no bloquear al usuario por un problema
 * de infra opcional).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: timeout after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Timeout estándar para llamadas Redis. 1500 ms es suficiente para
 * Upstash sano (latencia típica <50ms) y suficientemente corto para
 * que el usuario no perciba el lag cuando hay fallo.
 */
export const REDIS_TIMEOUT_MS = 1500;
