import { GroupAdminPanel } from "@/components/groups/group-admin-panel";
import { GroupAvatar } from "@/components/groups/group-avatar";
import { GroupLeaderboardView } from "@/components/groups/group-leaderboard-view";
import { JoinPublicGroupButton } from "@/components/groups/join-public-group-button";
import { LeaveGroupButton } from "@/components/groups/leave-group-button";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { GROUP_COLOR_STYLES } from "@/lib/group-colors";
import { db } from "@/server/db/client";
import { getFriendsAvailableToInvite } from "@/server/groups/invitations";
import {
  getGroupDetail,
  getGroupLinks,
  getGroupMembers,
  getGroupRanking,
  getOutboundGroupInvitations,
} from "@/server/groups/queries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

/**
 * Detalle de grupo. Estructura:
 *  - Header con avatar + nombre + count + badges (admin/ex-miembro).
 *  - Ranking (filtra+reorder sobre `user_points` + ex-miembros congelados).
 *  - Panel admin (solo si viewerIsAdmin): invitar, links, miembros, ajustes.
 *  - Botón "Abandonar grupo" si viewer es miembro NO admin.
 *
 * Si el viewer no tiene acceso (privado y no miembro/ex-miembro),
 * `getGroupDetail` devuelve null → 404.
 */
export default async function GrupoDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "groups" });
  const tr = await getTranslations({ locale, namespace: "groups.ranking" });
  const tb = await getTranslations({ locale, namespace: "groups.badge" });

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const detail = await getGroupDetail(db, id, session.user.id);
  if (!detail) notFound();

  const [ranking, members, links, outboundInvites, invitableFriends] = await Promise.all([
    getGroupRanking(db, id),
    detail.viewerIsAdmin ? getGroupMembers(db, id) : Promise.resolve([]),
    detail.viewerIsAdmin ? getGroupLinks(db, id) : Promise.resolve([]),
    detail.viewerIsAdmin ? getOutboundGroupInvitations(db, id) : Promise.resolve([]),
    detail.viewerIsAdmin ? getFriendsAvailableToInvite(id) : Promise.resolve([]),
  ]);

  const styles = GROUP_COLOR_STYLES[detail.color];

  return (
    <>
      <Link href="/social" className="text-[12px] font-bold text-muted hover:text-foreground">
        {t("backToSocial")}
      </Link>

      <header
        className={`mt-3 flex items-center gap-4 rounded-2xl border-2 border-border ${styles.bgSoft} px-4 py-4`}
      >
        <GroupAvatar color={detail.color} name={detail.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[22px] leading-none text-foreground">
            {detail.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-muted">
            <span>
              {detail.memberCount}/{detail.maxMembers}{" "}
              {detail.memberCount === 1 ? t("members.one") : t("members.many")}
            </span>
            <span>·</span>
            <span>{detail.visibility === "public" ? tb("public") : tb("private")}</span>
            {detail.viewerIsAdmin && (
              <span className="ml-1 rounded-full border border-gold/40 bg-gold/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-gold">
                {tb("admin")}
              </span>
            )}
            {detail.viewerIsFrozen && (
              <span className="ml-1 rounded-full border border-border bg-card-hover/60 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-muted">
                {tb("exMember")}
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="mt-6">
        <header className="mb-3 flex items-center gap-2.5">
          <span aria-hidden="true" className="text-[14px] leading-none text-gold">
            ◈
          </span>
          <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
            {tr("groupRankingTitle")}
          </h2>
        </header>
        <GroupLeaderboardView entries={ranking} />
      </section>

      {detail.viewerIsAdmin && (
        <GroupAdminPanel
          group={detail}
          members={members}
          pendingInvitations={outboundInvites}
          links={links}
          invitableFriends={invitableFriends}
        />
      )}

      {!detail.viewerIsAdmin && detail.viewerRole === "member" && (
        <section className="mt-6">
          <LeaveGroupButton groupId={detail.id} groupName={detail.name} />
        </section>
      )}

      {detail.viewerRole === null && !detail.viewerIsFrozen && detail.visibility === "public" && (
        <section className="mt-6">
          <JoinPublicGroupButton
            groupId={detail.id}
            full={detail.memberCount >= detail.maxMembers}
          />
        </section>
      )}
    </>
  );
}
