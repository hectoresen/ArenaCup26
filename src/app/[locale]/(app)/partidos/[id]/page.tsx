import { LivePredictionBlock } from "@/components/matches/live-prediction-block";
import { MatchDetailHero } from "@/components/matches/match-detail-hero";
import { PredictionForm } from "@/components/predictions/prediction-form";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getMatchById } from "@/server/matches/queries";
import { isPredictionWindowOpen } from "@/server/predictions/rules";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { submitPredictionAction } from "./actions";

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

  const canPredict =
    isPredictionWindowOpen(match.kickoffAt) &&
    (match.status === "scheduled" || match.status === "scheduled-tbd") &&
    match.homeTeam !== null &&
    match.awayTeam !== null;

  // Cuando el partido está en juego y el viewer tenía predicción,
  // preferimos el bloque "vas ganando / no todo está perdido" antes
  // que el banner genérico "Ventana cerrada — tu predicción se guardó".
  // El detalle del marcador en vivo lo aporta `MatchDetailHero`.
  const showLivePrediction =
    match.status === "live" &&
    match.prediction !== null &&
    match.homeTeam !== null &&
    match.awayTeam !== null;

  return (
    <>
      <BackLink />
      <MatchDetailHero match={match} />
      {canPredict ? (
        <PredictionForm
          matchId={match.matchId}
          stage={match.stage}
          homeTeamName={match.homeTeam?.name ?? "—"}
          awayTeamName={match.awayTeam?.name ?? "—"}
          initial={match.prediction}
          onSubmit={submitPredictionAction}
        />
      ) : showLivePrediction ? (
        // biome-ignore lint/style/noNonNullAssertion: garantizado por `showLivePrediction`.
        <LivePredictionBlock
          homeName={match.homeTeam!.name}
          awayName={match.awayTeam!.name}
          // biome-ignore lint/style/noNonNullAssertion: idem.
          prediction={match.prediction!}
          provisional={match.provisional}
        />
      ) : (
        <ClosedPredictionBanner status={match.status} hasPrediction={match.prediction !== null} />
      )}
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
 * Banner cuando la ventana de predicción está cerrada (kickoff
 * pasado, live, finished, etc.). Si el user tenía predicción la
 * mostramos a modo informativo.
 */
function ClosedPredictionBanner({
  status,
  hasPrediction,
}: {
  status: string;
  hasPrediction: boolean;
}) {
  const t = useTranslations("matches.closedWindow");
  const key = status === "live" || status === "finished" ? "started" : "locked";
  return (
    <article className="mt-4 rounded-2xl border-2 border-border bg-card px-5 py-5 text-center">
      <div className="mb-2 font-display text-base text-muted">{t(`title.${key}`)}</div>
      <p className="mx-auto max-w-xs text-[12px] font-bold leading-snug text-muted">
        {hasPrediction ? t("bodyHadPrediction") : t("bodyNoPrediction")}
      </p>
    </article>
  );
}
