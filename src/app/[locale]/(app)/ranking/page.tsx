import { GroupLeaderboardView } from "@/components/groups/group-leaderboard-view";
import {
  type GroupNavEntry,
  RankingNav,
  type RankingScope,
} from "@/components/groups/ranking-nav";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { derr } from "@/lib/debug-log";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getRealSnapshot } from "@/lib/leaderboard/real";
import { db } from "@/server/db/client";
import { getFriends, getFriendsRanking } from "@/server/friends/queries";
import { getGroupRanking, getUserGroups } from "@/server/groups/queries";
import type { GroupRankingEntry } from "@/server/groups/types";
import { setRequestLocale } from "next-intl/server";

/**
 * Ranking público dentro del área logada. Tres ámbitos seleccionables
 * vía `?scope=`:
 *
 *  - **Global** (default, sin param): mismo top 100 que la landing.
 *    Usa `<LeaderboardView>` con SSE.
 *  - **Amigos**: viewer + amigos aceptados. Mismo tie-break que global.
 *  - **Grupos**: requiere `?g=<groupId>`. Si no se pasa, se elige el
 *    primero del viewer. Si no tiene grupos, empty state + CTA.
 *
 * URL-driven (mismo patrón que `mini-leaderboard` de /inicio) para
 * que cada vista sea compartible y el back del browser funcione.
 */
export default async function RankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ scope?: string; g?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { scope: scopeParam, g: groupParam } = await searchParams;
  const scope: RankingScope =
    scopeParam === "amigos"
      ? "amigos"
      : scopeParam === "grupos"
        ? "grupos"
        : "global";

  const [snapshot, session] = await Promise.all([getRealSnapshot(db), auth()]);
  const viewerId = session?.user?.id ?? null;

  // Visitante sin sesión → solo ven el global, sin nav (no aplica).
  if (!viewerId) {
    return (
      <section className="-mx-5 -mt-5 flex justify-center px-5 pt-5">
        <LeaderboardView snapshot={snapshot} user={null} withChrome={false} />
      </section>
    );
  }

  const [friends, myGroups] = await Promise.all([
    getFriends(db, viewerId),
    getUserGroups(db, viewerId),
  ]);
  const hasFriends = friends.length > 0;
  const groupsForNav: GroupNavEntry[] = myGroups.map((g) => ({
    groupId: g.id,
    groupName: g.name,
    groupColor: g.color,
  }));

  // Si el user pidió `?scope=amigos` pero no tiene amigos, fallback a global.
  const effectiveScope: RankingScope =
    scope === "amigos" && !hasFriends ? "global" : scope;

  // Resolver grupo activo cuando scope = grupos.
  const activeGroupId =
    effectiveScope === "grupos"
      ? groupParam && myGroups.some((g) => g.id === groupParam)
        ? groupParam
        : (myGroups[0]?.id ?? null)
      : null;

  // Carga del ranking del scope seleccionado. Defensive: si la query
  // del scope no-Global falla por cualquier motivo (BD lenta, columna
  // nueva no migrada, error de drizzle…), degradamos a empty state en
  // vez de matar toda la página. El log nos avisa por Sentry.
  const friendsRanking: GroupRankingEntry[] =
    effectiveScope === "amigos"
      ? await getFriendsRanking(db, viewerId).catch((err: unknown) => {
          derr("ranking", "getFriendsRanking failed in /ranking", {
            viewerId,
            err: err instanceof Error ? err.message : String(err),
          });
          return [];
        })
      : [];
  const groupRanking: GroupRankingEntry[] =
    effectiveScope === "grupos" && activeGroupId
      ? await getGroupRanking(db, activeGroupId).catch((err: unknown) => {
          derr("ranking", "getGroupRanking failed in /ranking", {
            groupId: activeGroupId,
            err: err instanceof Error ? err.message : String(err),
          });
          return [];
        })
      : [];

  return (
    <section className="-mx-5 -mt-5 flex flex-col items-stretch px-5 pt-5">
      <RankingNav
        scope={effectiveScope}
        activeGroupId={activeGroupId}
        groups={groupsForNav}
        hasFriends={hasFriends}
      />

      {effectiveScope === "global" && (
        <LeaderboardView snapshot={snapshot} user={session?.user ?? null} withChrome={false} />
      )}

      {effectiveScope === "amigos" && (
        <GroupLeaderboardView
          entries={friendsRanking}
          title="Ranking entre amigos"
          countLabel={`${friendsRanking.length} ${friendsRanking.length === 1 ? "jugador" : "jugadores"}`}
        />
      )}

      {effectiveScope === "grupos" && (
        <>
          {myGroups.length === 0 ? (
            <div className="mx-auto w-full max-w-[510px]">
              <NoGroupsEmptyState />
            </div>
          ) : (
            activeGroupId && (
              <GroupLeaderboardView
                entries={groupRanking}
                title={myGroups.find((g) => g.id === activeGroupId)?.name ?? "Grupo"}
                countLabel={`${groupRanking.length} ${groupRanking.length === 1 ? "miembro" : "miembros"}`}
              />
            )
          )}
        </>
      )}
    </section>
  );
}

/**
 * Empty state cuando el viewer pulsó "Grupos" sin tener ninguno. Copy
 * + CTA grande a `/social/grupos/nuevo`. Diseño consistente con los
 * empty states del resto del producto (border-dashed + texto explicativo
 * en `text-muted`).
 */
function NoGroupsEmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gold/30 bg-gold/[0.04] px-5 py-8 text-center">
      <div aria-hidden="true" className="mb-3 text-[34px]">
        👥
      </div>
      <h3 className="mb-2 font-display text-[16px] text-foreground">
        Aún no tienes grupos de competición
      </h3>
      <p className="mx-auto mb-5 max-w-[340px] text-[13px] font-bold leading-relaxed text-muted">
        Crea un grupo privado para competir contra tus amigos. Tendréis
        un ranking solo entre vosotros — con los mismos puntos del torneo.
      </p>
      <Link
        href="/social/grupos/nuevo"
        className="inline-block rounded-full bg-gold px-5 py-2.5 font-display text-[12px] uppercase tracking-[0.12em] text-background hover:bg-gold-deep"
      >
        + Crear grupo
      </Link>
      <div className="mt-3">
        <Link
          href="/social/grupos/descubrir"
          className="text-[11px] font-bold text-muted hover:text-foreground"
        >
          o explora grupos públicos →
        </Link>
      </div>
    </div>
  );
}
