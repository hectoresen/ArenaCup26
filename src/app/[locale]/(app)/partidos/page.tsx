import { BracketView } from "@/components/matches/bracket-view";
import { MatchesFiltersBar } from "@/components/matches/matches-filters";
import { MatchesList } from "@/components/matches/matches-list";
import { MatchesTabs, type MatchesView } from "@/components/matches/matches-tabs";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getBracketMatches, getFilteredMatches } from "@/server/matches/queries";
import type { MatchesFilters } from "@/server/matches/types";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Listado de partidos con dos vistas controladas por `?vista=`:
 *  - **todos** (default): cards agrupadas por día, filtrables por
 *    estado / fase / "solo mis predicciones" via `?status=`, `?stage=`,
 *    `?mias=`.
 *  - **bracket**: eliminatorias agrupadas por ronda (R16 → Final).
 *    No acepta filtros (la estructura del bracket es la propia
 *    semántica).
 *
 * Tabs y filtros server-side via search params — no JS state,
 * back/forward del navegador funcionan, URL compartible.
 */
export default async function PartidosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    vista?: string;
    status?: string;
    stage?: string;
    mias?: string;
  }>;
}) {
  const { locale } = await params;
  const { vista, status, stage, mias } = await searchParams;
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

  const filters = parseFilters({ status, stage, mias });
  const matches = await getFilteredMatches(db, session.user.id, filters);

  return (
    <PartidosLayout count={matches.length} view={view}>
      <MatchesFiltersBar active={filters} count={matches.length} />
      <MatchesList matches={matches} />
    </PartidosLayout>
  );
}

function parseFilters(raw: {
  status?: string;
  stage?: string;
  mias?: string;
}): MatchesFilters {
  return {
    status:
      raw.status === "live" || raw.status === "scheduled" || raw.status === "finished"
        ? raw.status
        : "all",
    stage:
      raw.stage === "group" || raw.stage === "knockout" ? raw.stage : "all",
    predictedOnly: raw.mias === "true",
  };
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
