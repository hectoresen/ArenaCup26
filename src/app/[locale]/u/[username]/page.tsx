import { TopChrome } from "@/components/layout/top-chrome";
import { ThrottledState } from "@/components/common/throttled-state";
import { InvitationsPlaceholderCard } from "@/components/profile/invitations-placeholder-card";
import { RecentPredictionsCard } from "@/components/profile/recent-predictions-card";
import { StreakStatsCard } from "@/components/profile/streak-stats-card";
import { AchievementsAccordion } from "@/components/public-profile/achievements-accordion";
import { ProfileHero } from "@/components/public-profile/profile-hero";
import { StatsRow } from "@/components/public-profile/stats-row";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { checkPublicReadLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { db } from "@/server/db/client";
import { getOwnerExtras } from "@/server/profile/owner-extras";
import { getPublicProfile } from "@/server/public-profile/queries";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

/**
 * Perfil público accesible sin sesión. Patrón de URL: `/u/<username>`.
 *
 * - `username` viene del segmento dinámico.
 * - Si no existe el usuario, `notFound()` (Next sirve la 404 estándar).
 * - Cuando el viewer es el dueño (`isOwner`), añadimos tres cajas
 *   extra solo visibles para él: stats de rachas, últimas 5
 *   predicciones, y placeholder de invitaciones. También se habilita
 *   el editor de avatar/nombre en el hero.
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

  const ip = getRequestIp(await headers());
  const rl = await checkPublicReadLimit(ip);
  if (!rl.ok) {
    return <ThrottledState />;
  }

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const profile = await getPublicProfile(db, username, viewerId);
  if (!profile) notFound();

  const isOwner = Boolean(
    viewerId && session?.user?.username === profile.identity.username,
  );
  const t = await getTranslations({ locale, namespace: "publicProfile" });

  // Cajas extra solo para el dueño. Lazy: anon/visitantes no
  // pagan estas queries.
  const ownerExtras = isOwner && viewerId ? await getOwnerExtras(db, viewerId) : null;

  return (
    <>
      <TopChrome user={session?.user ?? null} />
      <main className="relative z-10 mx-auto max-w-[560px] px-5 py-9 pt-16">
        {isOwner && (
          <Link
            href="/inicio"
            className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-xs font-extrabold text-gold no-underline transition-[gap] hover:gap-2.5"
          >
            <span aria-hidden="true">←</span> {t("backToHome")}
          </Link>
        )}
        <ProfileHero identity={profile.identity} isOwner={isOwner} />
        <StatsRow stats={profile.stats} />
        {ownerExtras && (
          <>
            <StreakStatsCard stats={ownerExtras.streakStats} />
            <RecentPredictionsCard entries={ownerExtras.recentPredictions} />
            <InvitationsPlaceholderCard count={ownerExtras.invitationsCount} />
          </>
        )}
        <AchievementsAccordion
          achievements={profile.achievements}
          ownerUsername={profile.identity.username}
        />
      </main>
    </>
  );
}
