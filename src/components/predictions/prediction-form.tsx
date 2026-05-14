"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { PredictionKind, PredictionWinner } from "@/server/dashboard/types";
import { allowedKindsForStage } from "@/server/predictions/rules";
import type { SubmitPredictionResult } from "@/server/predictions/submit";
import type { MatchStage } from "@/server/scoring/types";

/**
 * Codes con traducción específica. El resto cae al fallback.
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
  onSubmit: (args: {
    matchId: string;
    kind: PredictionKind;
    predictedWinner: PredictionWinner | null;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
  }) => Promise<SubmitPredictionResult>;
};

/**
 * Id interno de cada opción del formulario. Mapea 1:1 a un payload
 * `{ kind, predictedWinner }` ya válido. `double-12` ("gana
 * cualquiera") no aparece porque no es una predicción significativa.
 */
type OptionId = "home" | "draw" | "away" | "home-or-draw" | "away-or-draw" | "exact";

type Option = {
  id: OptionId;
  label: string;
  hint?: string;
  kind: PredictionKind;
  winner: PredictionWinner | null;
};

function buildOptions(
  stage: MatchStage,
  home: string,
  away: string,
  labels: {
    teamWins: (team: string) => string;
    draw: string;
    teamOrDraw: (team: string) => string;
    exact: string;
    bonusSimple: string;
    bonusExact: string;
    bonusDouble: string;
  },
): Option[] {
  const allowed = allowedKindsForStage(stage);
  const inGroup = allowed.includes("double-1x");
  const opts: Option[] = [
    {
      id: "home",
      label: labels.teamWins(home),
      hint: labels.bonusSimple,
      kind: "simple",
      winner: "home",
    },
  ];
  if (inGroup) {
    opts.push({
      id: "home-or-draw",
      label: labels.teamOrDraw(home),
      hint: labels.bonusDouble,
      kind: "double-1x",
      winner: null,
    });
    opts.push({
      id: "draw",
      label: labels.draw,
      hint: labels.bonusSimple,
      kind: "simple",
      winner: "draw",
    });
    opts.push({
      id: "away-or-draw",
      label: labels.teamOrDraw(away),
      hint: labels.bonusDouble,
      kind: "double-x2",
      winner: null,
    });
  }
  opts.push({
    id: "away",
    label: labels.teamWins(away),
    hint: labels.bonusSimple,
    kind: "simple",
    winner: "away",
  });
  opts.push({
    id: "exact",
    label: labels.exact,
    hint: labels.bonusExact,
    kind: "exact",
    winner: null,
  });
  return opts;
}

function optionIdFromInitial(initial: Props["initial"]): OptionId {
  if (!initial) return "home";
  if (initial.kind === "exact") return "exact";
  if (initial.kind === "double-1x") return "home-or-draw";
  if (initial.kind === "double-x2") return "away-or-draw";
  if (initial.kind === "double-12") return "home"; // legacy — degradamos
  switch (initial.predictedWinner) {
    case "home":
      return "home";
    case "draw":
      return "draw";
    case "away":
      return "away";
    default:
      return "home";
  }
}

export function PredictionForm({
  matchId,
  stage,
  homeTeamName,
  awayTeamName,
  initial,
  onSubmit,
}: Props) {
  const t = useTranslations("predictions");
  const [selected, setSelected] = useState<OptionId>(optionIdFromInitial(initial));
  const [home, setHome] = useState<string>(
    initial?.kind === "exact" && initial.predictedHomeScore !== null
      ? String(initial.predictedHomeScore)
      : "",
  );
  const [away, setAway] = useState<string>(
    initial?.kind === "exact" && initial.predictedAwayScore !== null
      ? String(initial.predictedAwayScore)
      : "",
  );
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { type: "ok" } | { type: "error"; code: string } | null
  >(null);

  const options = buildOptions(stage, homeTeamName, awayTeamName, {
    teamWins: (team) => t("option.teamWins", { team }),
    draw: t("option.draw"),
    teamOrDraw: (team) => t("option.teamOrDraw", { team }),
    exact: t("option.exact"),
    bonusSimple: t("bonus.simple"),
    bonusExact: t("bonus.exact"),
    bonusDouble: t("bonus.double"),
  });
  const currentOption = options.find((o) => o.id === selected) ?? options[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!currentOption) return;
    startTransition(async () => {
      const payload =
        currentOption.kind === "exact"
          ? {
              matchId,
              kind: "exact" as const,
              predictedWinner: null,
              predictedHomeScore: home === "" ? null : Number(home),
              predictedAwayScore: away === "" ? null : Number(away),
            }
          : {
              matchId,
              kind: currentOption.kind,
              predictedWinner: currentOption.winner,
              predictedHomeScore: null,
              predictedAwayScore: null,
            };
      const result = await onSubmit(payload);
      setFeedback(result.ok ? { type: "ok" } : { type: "error", code: result.code });
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border-2 border-border bg-card px-4 py-5 sm:px-5"
    >
      <h2 className="mb-1 font-display text-base text-gold">
        {initial ? t("titleEdit") : t("titleNew")}
      </h2>
      <p className="mb-4 text-[12px] font-bold leading-snug text-muted">{t("subtitle")}</p>

      <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={t("optionsLabel")}>
        <legend className="sr-only">{t("optionsLabel")}</legend>
        {options.map((opt) => (
          <OptionTile
            key={opt.id}
            option={opt}
            selected={opt.id === selected}
            onSelect={() => setSelected(opt.id)}
          />
        ))}
      </fieldset>

      {currentOption?.id === "exact" && (
        <ExactInputs
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          home={home}
          away={away}
          onHome={setHome}
          onAway={setAway}
        />
      )}

      {feedback?.type === "ok" && (
        <p className="mt-4 rounded-md border-[1.5px] border-success/30 bg-success/10 px-3 py-2 text-[12px] font-bold text-success">
          ✓ {t("savedOk")}
        </p>
      )}
      {feedback?.type === "error" && (
        <p className="mt-4 rounded-md border-[1.5px] border-danger/30 bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger">
          {feedback.code in KNOWN_ERROR_CODES
            ? t(`errors.${feedback.code as keyof typeof KNOWN_ERROR_CODES}`)
            : t("errors.fallback")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full cursor-pointer rounded-[10px] border-2 border-gold bg-gold/15 px-4 py-3 text-sm font-extrabold text-gold transition-colors hover:bg-gold/25 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? t("submitting") : initial ? t("submitEdit") : t("submitNew")}
      </button>
    </form>
  );
}

function OptionTile({
  option,
  selected,
  onSelect,
}: {
  option: Option;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      // biome-ignore lint/a11y/useSemanticElements: <button role=radio> mantiene el styling de chip; un input radio rompe el layout.
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`group flex w-full cursor-pointer items-start gap-3 rounded-[12px] border-2 px-3.5 py-3 text-start transition-colors ${
        selected
          ? "border-gold bg-gold/10 text-gold"
          : "border-border bg-card text-foreground hover:bg-card-hover"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-gold bg-gold" : "border-muted"
        }`}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-background" />}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-extrabold leading-tight">{option.label}</span>
        {option.hint && (
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.06em] ${
              selected ? "text-gold/70" : "text-muted"
            }`}
          >
            {option.hint}
          </span>
        )}
      </span>
    </button>
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
    <div className="mt-3 rounded-xl border-[1.5px] border-gold/30 bg-gold/[0.04] px-3 py-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <ScoreInput label={homeTeamName} value={home} onChange={onHome} />
        <span className="font-display text-2xl text-muted">–</span>
        <ScoreInput label={awayTeamName} value={away} onChange={onAway} />
      </div>
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
      <span className="line-clamp-1 max-w-full text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={20}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-[80px] rounded-[10px] border-2 border-border bg-card-hover px-3 py-2 text-center font-display text-2xl text-foreground outline-none focus:border-gold"
      />
    </label>
  );
}
