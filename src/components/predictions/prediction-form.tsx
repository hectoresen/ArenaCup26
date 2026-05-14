"use client";

import type { PredictionKind, PredictionWinner } from "@/server/dashboard/types";
import { allowedKindsForStage } from "@/server/predictions/rules";
import type { SubmitPredictionResult } from "@/server/predictions/submit";
import type { MatchStage } from "@/server/scoring/types";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

/**
 * Codes que sí tienen traducción específica. El resto cae al
 * mensaje genérico.
 */
const KNOWN_ERROR_CODES = {
  match_not_found: true,
  match_window_closed: true,
  match_already_started: true,
  kind_not_allowed_for_stage: true,
  simple_missing_winner: true,
  simple_draw_in_knockout: true,
  exact_missing_scores: true,
  exact_negative_scores: true,
  exact_unreasonable_scores: true,
  double_has_winner_or_scores: true,
} as const;

type Props = {
  matchId: string;
  stage: MatchStage;
  homeTeamName: string;
  awayTeamName: string;
  initial: {
    kind: PredictionKind;
    predictedWinner: PredictionWinner | null;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
  } | null;
  /** Closure que invoca el server action. El caller lo pasa por prop. */
  onSubmit: (args: {
    matchId: string;
    kind: PredictionKind;
    predictedWinner: PredictionWinner | null;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
  }) => Promise<SubmitPredictionResult>;
};

/**
 * Formulario interactivo para enviar/editar predicción.
 *
 * - Tab por `kind` (filtrado por stage).
 * - Inputs específicos para cada kind.
 * - Submit asíncrono con `useTransition`; pre-rellena con `initial`
 *   si ya hay predicción.
 * - Errores devueltos por el server action se traducen a mensajes
 *   i18n.
 */
export function PredictionForm({
  matchId,
  stage,
  homeTeamName,
  awayTeamName,
  initial,
  onSubmit,
}: Props) {
  const t = useTranslations("predictions");
  const allowed = allowedKindsForStage(stage);

  const [kind, setKind] = useState<PredictionKind>(initial?.kind ?? "simple");
  const [winner, setWinner] = useState<PredictionWinner | null>(initial?.predictedWinner ?? null);
  const [home, setHome] = useState<string>(
    initial?.predictedHomeScore !== null && initial?.predictedHomeScore !== undefined
      ? String(initial.predictedHomeScore)
      : "",
  );
  const [away, setAway] = useState<string>(
    initial?.predictedAwayScore !== null && initial?.predictedAwayScore !== undefined
      ? String(initial.predictedAwayScore)
      : "",
  );
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" } | { type: "error"; code: string } | null>(
    null,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const payload = {
        matchId,
        kind,
        predictedWinner: kind === "simple" ? winner : null,
        predictedHomeScore: kind === "exact" ? Number(home) : null,
        predictedAwayScore: kind === "exact" ? Number(away) : null,
      };
      const result = await onSubmit(payload);
      if (result.ok) {
        setFeedback({ type: "ok" });
      } else {
        setFeedback({ type: "error", code: result.code });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border-2 border-border bg-card px-5 py-5"
    >
      <h2 className="mb-3 font-display text-base text-gold">
        {initial ? t("titleEdit") : t("titleNew")}
      </h2>

      <KindTabs allowed={allowed} value={kind} onChange={setKind} />

      <div className="mt-4">
        {kind === "simple" && (
          <SimpleSelector
            stage={stage}
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            value={winner}
            onChange={setWinner}
          />
        )}
        {kind === "exact" && (
          <ExactInputs
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            home={home}
            away={away}
            onHome={setHome}
            onAway={setAway}
          />
        )}
        {(kind === "double-1x" || kind === "double-x2" || kind === "double-12") && (
          <DoubleHint kind={kind} />
        )}
      </div>

      {feedback?.type === "ok" && (
        <p className="mt-3 rounded-md border-[1.5px] border-success/30 bg-success/10 px-3 py-2 text-[12px] font-bold text-success">
          ✓ {t("savedOk")}
        </p>
      )}
      {feedback?.type === "error" && (
        <p className="mt-3 rounded-md border-[1.5px] border-danger/30 bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger">
          {/* `next-intl` lanza si la key no existe; usamos el genérico
              cuando el code no esté traducido aún. */}
          {feedback.code in KNOWN_ERROR_CODES
            ? t(`errors.${feedback.code as keyof typeof KNOWN_ERROR_CODES}`)
            : t("errors.fallback")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-[10px] border-2 border-gold bg-gold/15 px-4 py-2.5 text-sm font-extrabold text-gold transition-colors hover:bg-gold/25 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? t("submitting") : initial ? t("submitEdit") : t("submitNew")}
      </button>
    </form>
  );
}

function KindTabs({
  allowed,
  value,
  onChange,
}: {
  allowed: readonly PredictionKind[];
  value: PredictionKind;
  onChange: (k: PredictionKind) => void;
}) {
  const t = useTranslations("predictions");
  // Agrupamos simple / exact en una primera línea y las dobles en una
  // segunda (cuando aplican). Resultado más compacto y legible.
  const primary = allowed.filter(
    (k) => k === "simple" || k === "exact",
  ) as readonly PredictionKind[];
  const doubles = allowed.filter((k) => k.startsWith("double-")) as readonly PredictionKind[];

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" className="flex gap-2">
        {primary.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={value === k}
            onClick={() => onChange(k)}
            className={`flex-1 rounded-[10px] border-2 px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.06em] transition-colors ${
              value === k
                ? "border-gold bg-gold/10 text-gold"
                : "border-border bg-card text-muted hover:bg-card-hover"
            }`}
          >
            {t(`kind.${k}`)}
          </button>
        ))}
      </div>
      {doubles.length > 0 && (
        <div role="tablist" className="flex gap-2">
          {doubles.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={value === k}
              onClick={() => onChange(k)}
              className={`flex-1 rounded-[10px] border-2 px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.06em] transition-colors ${
                value === k
                  ? "border-info bg-info/10 text-info"
                  : "border-border bg-card text-muted hover:bg-card-hover"
              }`}
            >
              {t(`kind.${k}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SimpleSelector({
  stage,
  homeTeamName,
  awayTeamName,
  value,
  onChange,
}: {
  stage: MatchStage;
  homeTeamName: string;
  awayTeamName: string;
  value: PredictionWinner | null;
  onChange: (w: PredictionWinner) => void;
}) {
  const t = useTranslations("predictions");
  const showDraw = stage === "group";
  const opts: { v: PredictionWinner; label: string }[] = showDraw
    ? [
        { v: "home", label: homeTeamName },
        { v: "draw", label: t("draw") },
        { v: "away", label: awayTeamName },
      ]
    : [
        { v: "home", label: homeTeamName },
        { v: "away", label: awayTeamName },
      ];
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-2 max-[420px]:grid-cols-1">
      {opts.map(({ v, label }) => (
        <button
          key={v}
          type="button"
          // biome-ignore lint/a11y/useSemanticElements: usamos <button> con role=radio para mantener el styling de chip y permitir Tab+Space; un <input type=radio> rompe el layout.
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-[10px] border-2 px-3 py-2.5 text-[13px] font-extrabold transition-colors ${
            value === v
              ? "border-gold bg-gold/10 text-gold"
              : "border-border bg-card text-foreground hover:bg-card-hover"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ExactInputs({
  homeTeamName,
  awayTeamName,
  home,
  away,
  onHome,
  onAway,
}: {
  homeTeamName: string;
  awayTeamName: string;
  home: string;
  away: string;
  onHome: (v: string) => void;
  onAway: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <ScoreInput label={homeTeamName} value={home} onChange={onHome} />
      <span className="font-display text-2xl text-muted">–</span>
      <ScoreInput label={awayTeamName} value={away} onChange={onAway} />
    </div>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1.5">
      <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={20}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border-2 border-border bg-card-hover px-3 py-2 text-center font-display text-xl text-foreground outline-none focus:border-gold"
      />
    </label>
  );
}

function DoubleHint({ kind }: { kind: "double-1x" | "double-x2" | "double-12" }) {
  const t = useTranslations("predictions");
  return (
    <p className="rounded-md border-[1.5px] border-info/30 bg-info/10 px-3 py-2 text-[12px] font-bold text-info">
      {t(`doubleHint.${kind}`)}
    </p>
  );
}
