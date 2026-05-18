import { eq } from "drizzle-orm";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";

/**
 * Ruta legacy: la sección "Logros" dejó de ser una pestaña dedicada
 * (2026-05-18). Los logros viven ahora dentro del perfil propio.
 * Mantenemos esta página como redirect server-side para no romper:
 *  - Bookmarks de usuarios que tuvieran /<locale>/logros guardada.
 *  - Notificaciones in-app antiguas con kind = "achievement_unlocked".
 *  - Links externos / posibles indexaciones en buscadores.
 *
 * Si el user no tiene username (caso raro: pre-onboarding), caemos a
 * `/inicio` que ya tiene su propia card resumen de logros.
 */
export default async function LogrosRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  // El session JWT puede traer el username, pero por defensa lo
  // releemos de BD por si el user lo cambió en esta misma sesión.
  const row = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const username = row[0]?.username ?? session.user.username;
  if (!username) {
    redirect(`/${locale}/inicio`);
  }
  redirect(`/${locale}/u/${username}#achievements`);
}
