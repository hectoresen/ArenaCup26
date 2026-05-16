import { FriendsList } from "@/components/friends/friends-list";
import { FriendRequestsInbox } from "@/components/friends/friend-requests-inbox";
import { AddFriendForm } from "@/components/friends/add-friend-form";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getFriends, getPendingFriendRequests } from "@/server/friends/queries";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Página de amigos: solicitudes pendientes arriba, lista de amigos
 * debajo, y un buscador minimalista por @username. Server component
 * que paraleliza las dos queries iniciales.
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

  const [requests, friends] = await Promise.all([
    getPendingFriendRequests(db, session.user.id),
    getFriends(db, session.user.id),
  ]);

  return <AmigosLayout pendingCount={requests.length} friendsCount={friends.length} requests={requests} friends={friends} />;
}

function AmigosLayout({
  pendingCount,
  friendsCount,
  requests,
  friends,
}: {
  pendingCount: number;
  friendsCount: number;
  requests: Awaited<ReturnType<typeof getPendingFriendRequests>>;
  friends: Awaited<ReturnType<typeof getFriends>>;
}) {
  const t = useTranslations("friends");
  return (
    <>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 font-display text-[26px] leading-none text-foreground">
            {t("title")}
          </h1>
          <p className="text-[13px] font-bold text-muted">
            {friendsCount} {friendsCount === 1 ? t("friendCount.one") : t("friendCount.many")}
            {pendingCount > 0
              ? ` · ${pendingCount} ${pendingCount === 1 ? t("pendingCount.one") : t("pendingCount.many")}`
              : ""}
          </p>
        </div>
        <Link
          href="/amigos/invitar"
          className="flex-shrink-0 cursor-pointer rounded-full border-2 border-gold/40 bg-gradient-to-br from-gold to-gold-deep px-4 py-1.5 font-display text-[12px] uppercase tracking-[0.1em] text-[#1a1000] no-underline shadow-[0_0_16px_rgba(245,200,66,0.25)] transition-[transform] hover:scale-[1.02]"
        >
          ✉️ {t("inviteByLink")}
        </Link>
      </header>

      <AddFriendForm />

      {requests.length > 0 && (
        <section className="mt-6">
          <header className="mb-3 flex items-center gap-2.5">
            <span aria-hidden="true" className="text-[14px] leading-none text-gold">◈</span>
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
          <span aria-hidden="true" className="text-[14px] leading-none text-gold">◈</span>
          <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
            {t("friendsHeader")}
          </h2>
        </header>
        <FriendsList friends={friends} />
      </section>
    </>
  );
}
