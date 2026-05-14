import { MatchesList } from "@/components/matches/matches-list";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getAllMatches } from "@/server/matches/queries";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Listado de todos los partidos disponibles, agrupados por día.
 * Click en una card lleva al detalle `/partidos/[id]`.
 */
export default async function PartidosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const matches = await getAllMatches(db, session.user.id);

  return (
    <PartidosLayout count={matches.length}>
      <MatchesList matches={matches} />
    </PartidosLayout>
  );
}

function PartidosLayout({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const t = useTranslations("matches");
  return (
    <>
      <header className="mb-6">
        <h1 className="mb-1 font-display text-[26px] leading-none text-foreground">{t("title")}</h1>
        <p className="text-[13px] font-bold text-muted">
          {count} {count === 1 ? t("matchCount.one") : t("matchCount.many")}
        </p>
      </header>
      {children}
    </>
  );
}
