import { ThrottledState } from "@/components/common/throttled-state";
import { FriendActionButton } from "@/components/friends/friend-action-button";
import { TopChrome } from "@/components/layout/top-chrome";
import { InvitationsPlaceholderCard } from "@/components/profile/invitations-placeholder-card";
import { RecentPredictionsCard } from "@/components/profile/recent-predictions-card";
import { StreakStatsCard } from "@/components/profile/streak-stats-card";
import { AchievementsAccordion } from "@/components/public-profile/achievements-accordion";
import { PrivateProfile } from "@/components/public-profile/private-profile";
import { ProfileHero } from "@/components/public-profile/profile-hero";
import { StatsRow } from "@/components/public-profile/stats-row";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getDivisionForRank } from "@/lib/leaderboard/division";
import { checkPublicReadLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { getAchievementsGateStatus } from "@/server/achievements/gate";
import { db } from "@/server/db/client";
import { getViewerRelationWithId } from "@/server/friends/queries";
import { getOwnerExtras } from "@/server/profile/owner-extras";
import { getPublicProfile } from "@/server/public-profile/queries";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

/**
 * Perfil público accesible sin sesión. Patrón de URL: `/u/<username>`.
 *
 * - `username` no existe → `notFound()`.
 * - El owner ha cerrado el perfil (`visibility` ≠ `'public'` y el
 *   viewer no es él) → renderizamos `<PrivateProfile>`. Importante:
 *   no `notFound()` — el ranking enlaza aquí para todos los users.
 * - Owner viendo su propio perfil o perfil público → perfil completo.
 *   Cuando el viewer es el dueño (`isOwner`), añadimos tres cajas
 *   extra solo visibles para él (rachas, predicciones, invitaciones)
 *   y se habilita el editor de avatar/nombre en el hero.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const result = await getPublicProfile(db, username);
  if (result.kind === "not_found") {
    return { title: "Perfil no encontrado · ArenaCup26" };
  }
  if (result.kind === "private") {
    return {
      title: `${result.identity.name} · ArenaCup26`,
      description: "Perfil privado en ArenaCup26.",
    };
  }
  return {
    title: `${result.profile.identity.name} · ArenaCup26`,
    description: `Perfil de ${result.profile.identity.name} (@${result.profile.identity.username}) en ArenaCup26.`,
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
  const result = await getPublicProfile(db, username, viewerId);
  if (result.kind === "not_found") notFound();

  if (result.kind === "private") {
    return (
      <>
        <TopChrome user={session?.user ?? null} />
        <main id="main-content" className="relative z-10 mx-auto max-w-[560px] px-5 py-9 pt-16">
          <PrivateProfile identity={result.identity} />
        </main>
      </>
    );
  }

  const profile = result.profile;
  const isOwner = Boolean(viewerId && session?.user?.username === profile.identity.username);
  const t = await getTranslations({ locale, namespace: "publicProfile" });

  // Cajas extra solo para el dueño. Lazy: anon/visitantes no
  // pagan estas queries.
  const ownerExtras = isOwner && viewerId ? await getOwnerExtras(db, viewerId) : null;

  // Gate de logros: si está activo, el acordeón pinta un aviso.
  const achievementsGate = await getAchievementsGateStatus();

  // Relación de amistad para el CTA. Solo se computa si hay viewer y
  // no es el dueño — el resto de visitantes no ven el botón.
  const friendInfo =
    viewerId && !isOwner
      ? await getViewerRelationWithId(db, viewerId, profile.identity.userId)
      : null;

  return (
    <>
      <TopChrome user={session?.user ?? null} />
      <main className="relative z-10 mx-auto max-w-[560px] px-5 py-9 pt-16">
        <Link
          href="/inicio"
          className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-xs font-extrabold text-gold no-underline transition-[gap] hover:gap-2.5"
        >
          <span aria-hidden="true">←</span> {t("backToHome")}
        </Link>
        <ProfileHero
          identity={profile.identity}
          isOwner={isOwner}
          cooldowns={ownerExtras?.cooldowns}
          division={getDivisionForRank(profile.stats.rank)}
        />
        {friendInfo && (
          <div className="mt-3 flex justify-center">
            <FriendActionButton
              initialRelation={friendInfo.relation}
              targetUsername={profile.identity.username}
              targetUserId={profile.identity.userId}
              pendingFriendshipId={friendInfo.friendshipId}
            />
          </div>
        )}
        <StatsRow stats={profile.stats} isOwner={isOwner} />
        {ownerExtras && (
          <>
            <StreakStatsCard stats={ownerExtras.streakStats} />
            <RecentPredictionsCard entries={ownerExtras.recentPredictions} />
            <InvitationsPlaceholderCard count={ownerExtras.invitationsCount} />
          </>
        )}
        {/* Historial de predicciones visible para visitantes si el
            owner tiene el toggle `showHistory` activo. Para el owner,
            esta caja es redundante con la del bloque ownerExtras
            (mismas predicciones), así que la ocultamos en su vista. */}
        {!isOwner && profile.publicHistory.length > 0 && (
          <RecentPredictionsCard entries={profile.publicHistory} viewer="visitor" />
        )}
        <AchievementsAccordion
          achievements={profile.achievements}
          ownerUsername={profile.identity.username}
          gate={achievementsGate}
        />
        {/* Los ajustes de cuenta viven ahora en `/ajustes`, accesible
            desde el dropdown del avatar (top right). Antes vivían
            aquí como acordeón pero forzaban al user a pasar por el
            perfil para configurar push/privacy/borrar cuenta. */}
      </main>
    </>
  );
}
