import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { MatchDetailHero } from "@/components/matches/match-detail-hero";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getMatchById } from "@/server/matches/queries";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const match = await getMatchById(db, id, session.user.id);
  if (!match) notFound();

  return (
    <>
      <BackLink />
      <MatchDetailHero match={match} />
      <PredictionPlaceholder hasPrediction={match.prediction !== null} />
    </>
  );
}

function BackLink() {
  const t = useTranslations("matches");
  return (
    <Link
      href="/partidos"
      className="mb-3 inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 py-1 text-[11px] font-extrabold text-muted no-underline transition-colors hover:border-gold/30 hover:text-foreground"
    >
      ← {t("backToList")}
    </Link>
  );
}

/**
 * Placeholder del formulario de predicción. Lo sustituirá el componente
 * real de `add-prediction-flow` (tarea siguiente).
 */
function PredictionPlaceholder({ hasPrediction }: { hasPrediction: boolean }) {
  const t = useTranslations("matches.predictionStub");
  return (
    <article className="mt-4 rounded-2xl border-2 border-border bg-card px-5 py-5 text-center">
      <div className="mb-2 font-display text-base text-gold">
        {hasPrediction ? t("titleEdit") : t("titleNew")}
      </div>
      <p className="mx-auto max-w-xs text-[12px] font-bold leading-snug text-muted">
        {t("body")}
      </p>
    </article>
  );
}
