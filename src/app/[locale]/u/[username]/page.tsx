import { TopChrome } from "@/components/layout/top-chrome";
import { ThrottledState } from "@/components/common/throttled-state";
import { AchievementsAccordion } from "@/components/public-profile/achievements-accordion";
import { ProfileHero } from "@/components/public-profile/profile-hero";
import { StatsRow } from "@/components/public-profile/stats-row";
import { auth } from "@/lib/auth";
import { checkPublicReadLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { db } from "@/server/db/client";
import { getPublicProfile } from "@/server/public-profile/queries";
import type { Metadata } from "next";
import { headers } from "next/headers";
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

  // Rate limit antes de cualquier query. Mismo cupo que la landing
  // (60 req/60s) — un scraper que recorra `/u/<username>` no debe
  // consumir nuestra BD.
  const ip = getRequestIp(await headers());
  const rl = await checkPublicReadLimit(ip);
  if (!rl.ok) {
    return <ThrottledState />;
  }

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const profile = await getPublicProfile(db, username, viewerId);
  if (!profile) notFound();

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
