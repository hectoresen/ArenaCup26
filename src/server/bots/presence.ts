import type { Database } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { inArray } from "drizzle-orm";
import { BOT_CATALOG } from "./catalog";

/**
 * Bots "live": un subset reducido del catálogo cuyo `lastActiveAt` se
 * refresca a diario para que aparezcan con el puntito verde en el
 * ranking durante el cold-start del Mundial. Sin esto, los bots
 * estarían siempre "offline" — el indicador online colapsa a ser
 * dominio exclusivo del propio Hector hasta que entre tráfico real.
 *
 * Diseño:
 *  - 5 bots escogidos para diversidad regional (Latam, Europa, Asia,
 *    África). Cinco es el mínimo que hablamos durante el diseño de
 *    `add-bot-users`; suficiente para que el ranking no se sienta
 *    desierto, pequeño para no falsear la sensación de actividad real.
 *  - Refresh cadencia: 24h máximo (mismo umbral que ONLINE_WINDOW_MS).
 *    El cron `auto-reject-bot-requests` corre 03:30 UTC diario y es
 *    el caller natural — un solo ping por día por bot.
 *  - Cutoff temporal: dejamos de refrescar tras la fase de grupos
 *    (WC26 termina el 03 jul 2026). A partir de ese punto los users
 *    reales deberían estar activos y los bots pueden caer a "offline"
 *    sin afectar la percepción del ranking.
 */
export const LIVE_BOT_USERNAMES = [
  "diego-martinez",
  "sofia-ramirez",
  "felix-hartmann",
  "yuki-tanaka",
  "omar-benali",
] as const;

/**
 * Tras esta fecha (UTC), `refreshLiveBotPresence` es no-op. Los bots
 * conservan su último `lastActiveAt` y caen a "offline" 24h después
 * de forma natural. Si se quiere extender, mover la constante hacia
 * delante en código (cambio sencillo, no hace falta migration).
 */
export const LIVE_BOTS_END_DATE = new Date("2026-07-04T00:00:00Z");

export function getLiveBotIds(): string[] {
  const usernames = new Set<string>(LIVE_BOT_USERNAMES);
  return BOT_CATALOG.filter((b) => usernames.has(b.username)).map((b) => b.id);
}

/**
 * Pinga `lastActiveAt` de los `LIVE_BOT_USERNAMES` a `now`. Idempotente
 * — re-correr durante el mismo segundo simplemente reescribe la misma
 * fila. Devuelve cuántos bots se tocaron (esperado: 5; 0 si estamos
 * pasado el cutoff o si los bots no están seedados todavía).
 */
export async function refreshLiveBotPresence(
  db: Database,
  now: Date = new Date(),
): Promise<number> {
  if (now >= LIVE_BOTS_END_DATE) return 0;
  const ids = getLiveBotIds();
  if (ids.length === 0) return 0;
  const result = await db
    .update(users)
    .set({ lastActiveAt: now })
    .where(inArray(users.id, ids))
    .returning({ id: users.id });
  return result.length;
}
