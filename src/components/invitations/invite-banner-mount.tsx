import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { INVITE_COOKIE } from "@/server/invitations/cookie-constants";
import { getActiveInviteContext } from "@/server/invitations/cookie";
import { InviteBanner } from "./invite-banner";

/**
 * Mount async server-component que decide si renderizar el banner.
 * Reglas:
 *
 *  1. Si no hay cookie de invite → no banner.
 *  2. Si hay cookie pero el viewer YA está logado → no banner (la
 *     invite ya se aplicó en `createUser` o caducó; no aporta nada).
 *  3. Si hay cookie pero el token no es redimible (revocado, agotado,
 *     no existe) → no banner. La cookie persiste (no podemos borrarla
 *     desde un server component); se limpiará en el próximo signup
 *     attempt fallido o al expirar (30 días).
 *  4. Si todo OK → resolvemos el inviter y montamos `<InviteBanner>`.
 *
 * Coste por render: una query a `invitations + users JOIN` solo
 * cuando la cookie existe. Visitantes anónimos sin cookie no pagan
 * nada extra.
 */
export async function InviteBannerMount() {
  const cookieStore = await cookies();
  const token = cookieStore.get(INVITE_COOKIE)?.value;
  if (!token) return null;

  // Si ya hay sesión, la invite o se aplicó (deletada en createUser)
  // o nunca se va a aplicar a este user (ya tiene cuenta) — mostrar
  // banner sería confuso.
  const session = await auth();
  if (session?.user?.id) return null;

  const ctx = await getActiveInviteContext(db, token);
  if (!ctx) return null;

  return (
    <InviteBanner
      inviterName={ctx.inviterName}
      inviterUsername={ctx.inviterUsername}
    />
  );
}
