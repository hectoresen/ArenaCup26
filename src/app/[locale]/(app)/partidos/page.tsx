import { BracketView } from "@/components/matches/bracket-view";
import { MatchesList } from "@/components/matches/matches-list";
import { MatchesTabs, type MatchesView } from "@/components/matches/matches-tabs";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getAllMatches, getBracketMatches } from "@/server/matches/queries";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Listado de partidos con dos vistas controladas por `?vista=`:
 *  - **todos** (default): cards agrupadas por día, vista actual.
 *  - **bracket**: eliminatorias agrupadas por ronda (R16 → Final).
 *
 * Tabs server-side via search param — no JS state, back/forward del
 * navegador funcionan, y se puede compartir un link directo al bracket.
 */
export default async function PartidosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { locale } = await params;
  const { vista } = await searchParams;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const view: MatchesView = vista === "bracket" ? "bracket" : "todos";

  if (view === "bracket") {
    const bracket = await getBracketMatches(db, session.user.id);
    const totalMatches = bracket.rounds.reduce((sum, r) => sum + r.matches.length, 0);
    return (
      <PartidosLayout count={totalMatches} view={view}>
        <BracketView bracket={bracket} />
      </PartidosLayout>
    );
  }

  const matches = await getAllMatches(db, session.user.id);
  return (
    <PartidosLayout count={matches.length} view={view}>
      <MatchesList matches={matches} />
    </PartidosLayout>
  );
}

function PartidosLayout({
  count,
  view,
  children,
}: {
  count: number;
  view: MatchesView;
  children: React.ReactNode;
}) {
  const t = useTranslations("matches");
  return (
    <>
      <header className="mb-5">
        <h1 className="mb-1 font-display text-[26px] leading-none text-foreground">{t("title")}</h1>
        <p className="text-[13px] font-bold text-muted">
          {count} {count === 1 ? t("matchCount.one") : t("matchCount.many")}
        </p>
      </header>
      <MatchesTabs active={view} />
      {children}
    </>
  );
}
