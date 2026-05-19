import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { users } from "@/server/db/schema";

/**
 * Helpers internos para distinguir users reales de bots en métricas.
 * NO se usan en API pública — solo `/status` (cuando lo expongamos
 * en métricas) y herramientas de admin/analytics.
 */

/**
 * Cuenta los users que NO son bots. Útil para "Real MAU" honesto.
 *
 * Excluye:
 *  - Bots (`is_bot = true`).
 *
 * NO excluye:
 *  - Users sin `onboardedAt` (siguen siendo humanos en proceso).
 *  - Users sin sessions activas (definir "activo" en el caller con
 *    `lastActiveAt`).
 */
export async function getRealUserCount(db: Database): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.isBot, false));
  return rows[0]?.total ?? 0;
}

/**
 * Cuenta los users reales con `onboardedAt IS NOT NULL` —
 * completaron el wizard. Métrica de "usuarios funcionales".
 */
export async function getOnboardedRealUserCount(db: Database): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.isBot, false), isNotNull(users.onboardedAt)));
  return rows[0]?.total ?? 0;
}

/**
 * Cuenta los bots. Para validación operativa ("¿siguen los 27 ahí?").
 */
export async function getBotCount(db: Database): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.isBot, true));
  return rows[0]?.total ?? 0;
}
