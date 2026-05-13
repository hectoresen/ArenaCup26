import { TopChrome } from "@/components/layout/top-chrome";
import { AchievementsAccordion } from "@/components/public-profile/achievements-accordion";
import { ProfileHero } from "@/components/public-profile/profile-hero";
import { StatsRow } from "@/components/public-profile/stats-row";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getPublicProfile } from "@/server/public-profile/queries";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

/**
 * Perfil público accesible sin sesión. Patrón de URL: `/u/<username>`.
 *
 * - `username` viene del segmento dinámico.
 * - Si no existe el usuario, `notFound()` (Next sirve la 404 estándar).
 * - El layout NO usa el `<AppShell>` privado; en su lugar mantiene el
 *   `<TopChrome>` (LanguageSwitcher + AccountMenu o JoinCta) que ya
 *   usa el resto del área pública. Así un visitante anónimo puede ver
 *   el perfil y el dueño tiene su menú de cuenta arriba a la derecha.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(db, username);
  if (!profile) {
    return { title: "Perfil no encontrado · WebMundial 26" };
  }
  return {
    title: `${profile.identity.name} · WebMundial 26`,
    description: `Perfil de ${profile.identity.name} (@${profile.identity.username}) en WebMundial 26.`,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  setRequestLocale(locale);

  const profile = await getPublicProfile(db, username);
  if (!profile) notFound();

  const session = await auth();

  return (
    <>
      <TopChrome user={session?.user ?? null} />
      <main className="relative z-10 mx-auto max-w-[560px] px-5 py-9 pt-16">
        <ProfileHero identity={profile.identity} />
        <StatsRow stats={profile.stats} />
        <AchievementsAccordion
          achievements={profile.achievements}
          ownerUsername={profile.identity.username}
        />
      </main>
    </>
  );
}
