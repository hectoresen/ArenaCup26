import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { RankingScopeTabs, type GroupTabData } from "@/components/groups/ranking-scope-tabs";
import { auth } from "@/lib/auth";
import { getRealSnapshot } from "@/lib/leaderboard/real";
import { db } from "@/server/db/client";
import { getGroupRanking, getUserGroups } from "@/server/groups/queries";
import { setRequestLocale } from "next-intl/server";

/**
 * Ranking público dentro del área logada. Reusa el mismo
 * `LeaderboardView` que la landing pero sin su propio `<TopChrome>`
 * (el `<AppShell>` del route group `(app)` ya monta nav + avatar +
 * bell).
 *
 * Cuando el viewer pertenece a algún grupo, se renderiza
 * `<RankingScopeTabs>` arriba con el control [Global][Grupo X]...
 * Si no tiene grupos, el control NO se monta (página igual que antes).
 *
 * Dataset real: query a `userPoints` mezclada con 3 placeholders fijos
 * para que el ranking no se vea vacío durante la fase de pruebas.
 * Cuando aterrice `add-leaderboard-sse` se reemplaza por suscripción
 * push sin cambiar el componente.
 */
export default async function RankingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [snapshot, session] = await Promise.all([getRealSnapshot(db), auth()]);

  const viewerId = session?.user?.id ?? null;
  const myGroups = viewerId ? await getUserGroups(db, viewerId) : [];
  const groupTabs: GroupTabData[] = myGroups.length
    ? await Promise.all(
        myGroups.map(async (g) => ({
          groupId: g.id,
          groupName: g.name,
          groupColor: g.color,
          ranking: await getGroupRanking(db, g.id),
        })),
      )
    : [];

  const globalContent = (
    <LeaderboardView snapshot={snapshot} user={session?.user ?? null} withChrome={false} />
  );

  return (
    <section className="-mx-5 -mt-5 flex justify-center px-5 pt-5">
      {groupTabs.length > 0 ? (
        <RankingScopeTabs
          globalContent={globalContent}
          groups={groupTabs}
          viewerUserId={viewerId}
        />
      ) : (
        globalContent
      )}
    </section>
  );
}
