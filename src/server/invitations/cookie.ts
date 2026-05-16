import { eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { invitations, users } from "@/server/db/schema";

// Constantes Edge-safe (sin imports a Drizzle) viven en
// `cookie-constants.ts` para que `middleware.ts` no arrastre el
// cliente DB. Re-exportamos aquí para single import path.
export { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE_SECONDS } from "./cookie-constants";

export type ActiveInviteContext = {
  /** Token actual de la cookie (válido). */
  token: string;
  /** Nombre del inviter para mostrar en el banner. Fallback "alguien" si null. */
  inviterName: string;
  /** Username del inviter (puede ser null si no completó onboarding). */
  inviterUsername: string | null;
};

/**
 * Resuelve el inviter para un token de cookie. Devuelve `null` si:
 *  - El token no apunta a ninguna invitación válida (revocada/agotada/inexistente).
 *  - El user del inviter no se puede resolver (no debería pasar, defensivo).
 *
 * El caller debe borrar la cookie cuando devuelve `null` para evitar
 * llamadas repetidas que no van a tener éxito.
 */
export async function getActiveInviteContext(
  db: Database,
  token: string,
): Promise<ActiveInviteContext | null> {
  const rows = await db
    .select({
      inviterId: invitations.inviterId,
      revokedAt: invitations.revokedAt,
      maxUses: invitations.maxUses,
      uses: invitations.uses,
      inviterName: users.name,
      inviterUsername: users.username,
    })
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.inviterId))
    .where(eq(invitations.token, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.maxUses > 0 && row.uses >= row.maxUses) return null;

  return {
    token,
    inviterName: row.inviterName?.trim() || "alguien",
    inviterUsername: row.inviterUsername,
  };
}
