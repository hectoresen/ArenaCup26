import { eq, sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { BOT_CATALOG, botEmail } from "./catalog";

/**
 * Reconcilia los 27 bots del catálogo en la tabla `users`.
 *
 * Idempotente — usa `ON CONFLICT (username) DO UPDATE`. Re-correr
 * tras editar el catálogo refresca name, country, avatar, etc. La
 * fila persiste (mismo `id`), así los referees externos (foreign
 * keys de predictions, point_events, achievements) no se rompen.
 *
 * Output: `{ created, updated }` para que el bootstrap loguee.
 *
 * IMPORTANTE: no crea filas en `accounts` (sin OAuth) ni en
 * `push_subscriptions`. Los bots nunca pueden iniciar sesión ni
 * recibir push.
 */
export async function seedBotUsers(db: Database): Promise<{
  created: number;
  updated: number;
}> {
  let created = 0;
  let updated = 0;
  const now = Date.now();

  for (const bot of BOT_CATALOG) {
    // `created_at` escalonado en el pasado para que el perfil
    // (`/u/<username>`) no muestre "se unió hace 1 minuto" cuando
    // un user inspeccione un bot.
    const createdAt = new Date(now - bot.createdAtOffsetDays * 86_400_000);

    const result = await db
      .insert(users)
      .values({
        id: bot.id,
        username: bot.username,
        name: bot.name,
        email: botEmail(bot.username),
        country: bot.country,
        avatarId: bot.avatarId,
        isBot: true,
        // `onboarded_at` se setea inmediato — los bots NO ven el
        // wizard de bienvenida (nadie loguea como bot).
        onboardedAt: createdAt,
        createdAt,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          name: bot.name,
          country: bot.country,
          avatarId: bot.avatarId,
          isBot: true,
          // No tocamos `createdAt` en update — preserva el "se unió
          // hace X días" si el bot ya existía. Si quisiéramos
          // refrescarlo, descomentar:
          // createdAt,
        },
      })
      .returning({
        id: users.id,
        createdAtNow: sql<boolean>`xmax = 0`,
      });

    if (result[0]?.createdAtNow) created++;
    else updated++;
  }

  return { created, updated };
}

/**
 * Helper: ¿este userId pertenece a un bot? Útil para queries
 * server-side internas (auto-reject cron, métricas) sin tener que
 * hacer un join con `users`.
 *
 * Cacheable a nivel proceso si fuera necesario — el catálogo es
 * estático y los IDs son determinísticos.
 */
const BOT_IDS = new Set(BOT_CATALOG.map((b) => b.id));

export function isBotUserId(userId: string): boolean {
  return BOT_IDS.has(userId);
}

/**
 * Lista los bots activos (live + frozen) en BD. NO se usa en API
 * pública — solo scripts/admin/analytics.
 */
export async function listBots(db: Database) {
  return db.select().from(users).where(eq(users.isBot, true));
}
