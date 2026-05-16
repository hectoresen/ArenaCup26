import { eq } from "drizzle-orm";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AchievementsIconSprite } from "@/components/public-profile/achievement-sprite";
import { TierSection } from "@/components/public-profile/tier-section";
import { dlog } from "@/lib/debug-log";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { users, userAchievements } from "@/server/db/schema";
import { buildProfileAchievements } from "@/server/public-profile/transforms";

/**
 * Catálogo completo de logros del usuario logado. Reusa el shape
 * `ProfileAchievements` (mismo que `/u/<username>`) para que las
 * cards y el agrupado por tier sean consistentes.
 *
 * Diferencias frente al acordeón del perfil público:
 *  - Aquí todo está abierto (no es un `<details>`): es la página
 *    principal de la sección.
 *  - El header tiene su propio título + progreso destacado.
 *  - Usa `ownerUsername` del propio user para que el botón
 *    "Compartir" de los tiers altos enlace a su perfil público.
 */
export default async function LogrosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const t = await getTranslations({ locale, namespace: "achievementsPage" });

  // Resolvemos el username del user actual para que el botón
  // "Compartir" de los tiers altos enlace a `/u/<username>`. Si por
  // algún motivo no tiene username (debería tener tras el backfill
  // del signup), pasamos un placeholder no clicable.
  const userRow = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const ownerUsername = userRow[0]?.username ?? "yo";

  // Logros desbloqueados del user (id + when).
  const unlocked = await db
    .select({
      achievementId: userAchievements.achievementId,
      unlockedAt: userAchievements.unlockedAt,
    })
    .from(userAchievements)
    .where(eq(userAchievements.userId, session.user.id));
  const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));
  const achievements = buildProfileAchievements(unlockedMap);
  dlog("ranking", "logros page rendered", {
    userId: session.user.id,
    unlocked: achievements.unlockedCount,
    total: achievements.totalCount,
  });

  const pct =
    achievements.totalCount > 0
      ? Math.round((achievements.unlockedCount / achievements.totalCount) * 100)
      : 0;

  return (
    <section className="-mx-5 -mt-5 px-5 pt-5">
      {/* Sprite SVG con los 24 símbolos del catálogo. Sin esto los
          <use href="#ach-..."> de las cards renderizan vacíos
          (idéntico al patrón del <AchievementsAccordion>). */}
      <AchievementsIconSprite />
      <header className="mb-6 text-center">
        <h1 className="font-display text-3xl text-gold">{t("title")}</h1>
        <p className="mt-2 text-sm font-bold text-muted">
          {t("subtitle", {
            unlocked: achievements.unlockedCount,
            total: achievements.totalCount,
          })}
        </p>
        <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-white/[0.07]">
          <div
            aria-hidden="true"
            className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <div className="space-y-6">
        {achievements.groups.map((group) => (
          <TierSection key={group.tier} group={group} ownerUsername={ownerUsername} />
        ))}
      </div>
    </section>
  );
}
