import { HistoryFiltersBar } from "@/components/history/history-filters";
import { HistoryList } from "@/components/history/history-list";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { type HistoryOutcomeFilter, getPredictionHistory } from "@/server/history/queries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Historial de predicciones del user logado. URL-driven:
 * `?outcome=hit|miss|pending` filtra server-side. El header siempre
 * muestra el universo COMPLETO (sin filtro) para que el user vea su
 * stats global y navegue por slices con los chips.
 */
export default async function HistorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ outcome?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const t = await getTranslations({ locale, namespace: "history" });
  const { outcome: outcomeRaw } = await searchParams;
  const outcome: HistoryOutcomeFilter =
    outcomeRaw === "hit" || outcomeRaw === "miss" || outcomeRaw === "pending" ? outcomeRaw : "all";

  const [allEntries, filtered] = await Promise.all([
    getPredictionHistory(db, session.user.id),
    outcome === "all"
      ? Promise.resolve(null)
      : getPredictionHistory(db, session.user.id, { outcome }),
  ]);

  const entries = filtered ?? allEntries;
  const total = allEntries.length;
  const correct = allEntries.filter((e) => (e.pointsEarned ?? 0) > 0).length;
  const missed = allEntries.filter(
    (e) => e.status === "finished" && (e.pointsEarned ?? 0) === 0,
  ).length;
  const pending = allEntries.filter((e) => e.pointsEarned === null).length;
  const totalPoints = allEntries.reduce((sum, e) => sum + (e.pointsEarned ?? 0), 0);

  return (
    <section className="-mx-5 -mt-5 px-5 pt-5">
      <header className="mb-6 text-center">
        <h1 className="font-display text-3xl text-gold">{t("title")}</h1>
        <p className="mt-2 text-sm font-bold text-muted">
          {t("subtitle", { total, correct, points: totalPoints })}
        </p>
      </header>

      <HistoryFiltersBar
        active={outcome}
        counts={{ all: total, hit: correct, miss: missed, pending }}
      />

      <HistoryList entries={entries} />
    </section>
  );
}
