import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HistoryList } from "@/components/history/history-list";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getPredictionHistory } from "@/server/history/queries";

/**
 * Historial de predicciones del user logado. Cada entrada muestra
 * equipos, marcador real (si terminó), tu predicción y puntos
 * ganados. Ordenado por kickoff descendente.
 */
export default async function HistorialPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const t = await getTranslations({ locale, namespace: "history" });
  const entries = await getPredictionHistory(db, session.user.id);

  const total = entries.length;
  const correct = entries.filter((e) => (e.pointsEarned ?? 0) > 0).length;
  const totalPoints = entries.reduce((sum, e) => sum + (e.pointsEarned ?? 0), 0);

  return (
    <section className="-mx-5 -mt-5 px-5 pt-5">
      <header className="mb-6 text-center">
        <h1 className="font-display text-3xl text-gold">{t("title")}</h1>
        <p className="mt-2 text-sm font-bold text-muted">
          {t("subtitle", { total, correct, points: totalPoints })}
        </p>
      </header>
      <HistoryList entries={entries} />
    </section>
  );
}
