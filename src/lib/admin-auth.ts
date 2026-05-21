import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { isAdminEmail } from "./admin-allowlist";

/**
 * Resultado del check de admin: o pasa con el user, o devuelve un
 * motivo de rechazo. El caller decide qué hacer (redirect a OAuth,
 * 403, etc.) según el contexto (server action, route, etc.).
 */
export type AdminCheck =
  | { ok: true; user: { id: string; email: string; name: string | null } }
  | { ok: false; reason: "no-session" | "not-allowlisted" | "not-admin-flag" | "banned" };

/**
 * Doble llave del admin:
 *  1. `auth()` devuelve sesión activa (Google OAuth válido).
 *  2. Email en `ADMIN_EMAILS` (allowlist hardcoded en git).
 *  3. `users.is_admin = true` en BD.
 *  4. `users.banned_until` no en el futuro.
 *
 * Si todas pasan → `{ ok: true, user }`. Si una falla → `{ ok: false, reason }`.
 * El caller (middleware, layout admin, server action) decide qué
 * respuesta enviar al cliente. Hay que mantener la lógica en un solo
 * sitio para que no se nos cuele un check incompleto en alguna
 * ruta nueva.
 */
export async function checkAdmin(): Promise<AdminCheck> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;

  if (!session || !userId || !email) {
    return { ok: false, reason: "no-session" };
  }

  if (!isAdminEmail(email)) {
    return { ok: false, reason: "not-allowlisted" };
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isAdmin: users.isAdmin,
      bannedUntil: users.bannedUntil,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isAdmin) {
    return { ok: false, reason: "not-admin-flag" };
  }

  if (row.bannedUntil && row.bannedUntil > new Date()) {
    return { ok: false, reason: "banned" };
  }

  return {
    ok: true,
    user: { id: row.id, email: row.email, name: row.name },
  };
}
