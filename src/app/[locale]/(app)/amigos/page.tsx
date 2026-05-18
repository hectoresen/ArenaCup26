import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Ruta legacy: `/amigos` se renombró a `/social` (2026-05-18) porque
 * la sección crece más allá de la lista de amigos (invitaciones,
 * grupos, ligas, retos…). Mantenemos este redirect para no romper:
 *  - Bookmarks.
 *  - Notificaciones in-app antiguas (kind `friend_request`/`friend_accepted`).
 *  - El hash `#invitaciones` que enlazaba desde el perfil propio.
 */
export default async function AmigosRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(`/${locale}/social`);
}
