import { AddFriendForm } from "@/components/friends/add-friend-form";
import { FriendRequestsInbox } from "@/components/friends/friend-requests-inbox";
import { FriendsList } from "@/components/friends/friends-list";
import { GroupInvitationsInbox } from "@/components/groups/group-invitations-inbox";
import { MyGroupsSection } from "@/components/groups/my-groups-section";
import { InvitationsManager } from "@/components/invitations/invitations-manager";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getFriends, getPendingFriendRequests } from "@/server/friends/queries";
import { MAX_GROUPS_PER_USER } from "@/server/groups/caps";
import { getPendingGroupInvitations, getUserGroups } from "@/server/groups/queries";
import { countRedeemedInvitations, getInvitations } from "@/server/invitations/queries";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Página única de gestión social: buscador por @username,
 * solicitudes pendientes, lista de amigos y links de invitación.
 * Todo en el mismo scroll para no obligar al user a saltar entre
 * subrutas y descubrir links que ya había generado.
 */
export default async function AmigosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const [requests, friends, invitations, redeemed, myGroups, groupInvites] = await Promise.all([
    getPendingFriendRequests(db, session.user.id),
    getFriends(db, session.user.id),
    getInvitations(db, session.user.id),
    countRedeemedInvitations(db, session.user.id),
    getUserGroups(db, session.user.id),
    getPendingGroupInvitations(db, session.user.id),
  ]);

  return (
    <AmigosLayout
      pendingCount={requests.length}
      friendsCount={friends.length}
      requests={requests}
      friends={friends}
      invitations={invitations}
      redeemed={redeemed}
      myGroups={myGroups}
      groupInvites={groupInvites}
    />
  );
}

function AmigosLayout({
  pendingCount,
  friendsCount,
  requests,
  friends,
  invitations,
  redeemed,
  myGroups,
  groupInvites,
}: {
  pendingCount: number;
  friendsCount: number;
  requests: Awaited<ReturnType<typeof getPendingFriendRequests>>;
  friends: Awaited<ReturnType<typeof getFriends>>;
  invitations: Awaited<ReturnType<typeof getInvitations>>;
  redeemed: number;
  myGroups: Awaited<ReturnType<typeof getUserGroups>>;
  groupInvites: Awaited<ReturnType<typeof getPendingGroupInvitations>>;
}) {
  const t = useTranslations("friends");
  const tInvite = useTranslations("invite");
  const tGroups = useTranslations("groups.invitationsInbox");
  return (
    <>
      <header className="mb-5">
        <h1 className="mb-1 font-display text-[26px] leading-none text-foreground">{t("title")}</h1>
        <p className="text-[13px] font-bold text-muted">
          {friendsCount} {friendsCount === 1 ? t("friendCount.one") : t("friendCount.many")}
          {pendingCount > 0
            ? ` · ${pendingCount} ${pendingCount === 1 ? t("pendingCount.one") : t("pendingCount.many")}`
            : ""}
        </p>
      </header>

      <AddFriendForm />

      <MyGroupsSection groups={myGroups} maxGroups={MAX_GROUPS_PER_USER} />

      {groupInvites.length > 0 && (
        <section className="mt-7">
          <header className="mb-3 flex items-center gap-2.5">
            <span aria-hidden="true" className="text-[14px] leading-none text-gold">
              ◈
            </span>
            <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
              {tGroups("title")}
            </h2>
            <span className="rounded-full border-[1.5px] border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-gold">
              {groupInvites.length}
            </span>
          </header>
          <GroupInvitationsInbox invitations={groupInvites} />
        </section>
      )}

      {requests.length > 0 && (
        <section className="mt-6">
          <header className="mb-3 flex items-center gap-2.5">
            <span aria-hidden="true" className="text-[14px] leading-none text-gold">
              ◈
            </span>
            <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
              {t("requestsHeader")}
            </h2>
            <span className="rounded-full border-[1.5px] border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-gold">
              {pendingCount}
            </span>
          </header>
          <FriendRequestsInbox requests={requests} />
        </section>
      )}

      <section className="mt-7">
        <header className="mb-3 flex items-center gap-2.5">
          <span aria-hidden="true" className="text-[14px] leading-none text-gold">
            ◈
          </span>
          <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
            {t("friendsHeader")}
          </h2>
        </header>
        <FriendsList friends={friends} />
      </section>

      <section id="invitaciones" className="mt-8">
        <header className="mb-3 flex items-center gap-2.5">
          <span aria-hidden="true" className="text-[14px] leading-none text-gold">
            ◈
          </span>
          <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
            {tInvite("title")}
          </h2>
        </header>
        <p className="mb-3 text-[12px] font-bold text-muted">
          {redeemed === 0
            ? tInvite("subtitleEmpty")
            : tInvite("subtitleCount", { count: redeemed })}
        </p>

        <aside
          role="note"
          aria-label={tInvite("warning.title")}
          className="mb-4 rounded-2xl border-2 border-warm/30 bg-warm/[0.06] px-4 py-3"
        >
          <div className="mb-1 flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.1em] text-warm">
            <span aria-hidden="true">⚠️</span>
            {tInvite("warning.title")}
          </div>
          <p className="text-[12px] font-bold leading-snug text-foreground/90">
            {tInvite("warning.body")}
          </p>
        </aside>

        <InvitationsManager invitations={invitations} />
      </section>
    </>
  );
}
