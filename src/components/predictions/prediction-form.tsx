"use client";

import type { PredictionKind, PredictionWinner } from "@/server/dashboard/types";
import { allowedKindsForStage, basePointsForKind } from "@/server/predictions/rules";
import type { SubmitPredictionResult } from "@/server/predictions/submit";
import type { MatchStage } from "@/server/scoring/types";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

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

type InitialPrediction = {
  kind: PredictionKind;
  predictedWinner: PredictionWinner | null;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
};

type Props = {
  matchId: string;
  stage: MatchStage;
  homeTeamName: string;
  awayTeamName: string;
  initial: InitialPrediction | null;
  onSubmit: (args: {
    matchId: string;
    kind: PredictionKind;
    predictedWinner: PredictionWinner | null;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
  }) => Promise<SubmitPredictionResult>;
};

type WinnerOptionId = "home" | "draw" | "away" | "home-or-draw" | "away-or-draw";

type WinnerOption = {
  id: WinnerOptionId;
  label: string;
  bonus: string;
  kind: PredictionKind;
  winner: PredictionWinner | null;
};

type Mode = "winner" | "exact";
type View = "summary" | "type-picker" | "options";

function buildWinnerOptions(
  stage: MatchStage,
  home: string,
  away: string,
  labels: {
    teamWins: (team: string) => string;
    draw: string;
    teamOrDraw: (team: string) => string;
    bonusSimple: string;
    bonusDouble: string;
  },
): WinnerOption[] {
  const allowed = allowedKindsForStage(stage);
  const inGroup = allowed.includes("double-1x");
  const opts: WinnerOption[] = [
    {
      id: "home",
      label: labels.teamWins(home),
      bonus: labels.bonusSimple,
      kind: "simple",
      winner: "home",
    },
  ];
  if (inGroup) {
    opts.push({
      id: "home-or-draw",
      label: labels.teamOrDraw(home),
      bonus: labels.bonusDouble,
      kind: "double-1x",
      winner: null,
    });
    opts.push({
      id: "draw",
      label: labels.draw,
      bonus: labels.bonusSimple,
      kind: "simple",
      winner: "draw",
    });
    opts.push({
      id: "away-or-draw",
      label: labels.teamOrDraw(away),
      bonus: labels.bonusDouble,
      kind: "double-x2",
      winner: null,
    });
  }
  opts.push({
    id: "away",
    label: labels.teamWins(away),
    bonus: labels.bonusSimple,
    kind: "simple",
    winner: "away",
  });
  return opts;
}

function modeFromKind(kind: PredictionKind): Mode {
  return kind === "exact" ? "exact" : "winner";
}

function winnerOptionFromInitial(initial: InitialPrediction | null): WinnerOptionId | null {
  if (!initial || initial.kind === "exact") return null;
  if (initial.kind === "double-1x") return "home-or-draw";
  if (initial.kind === "double-x2") return "away-or-draw";
  if (initial.kind === "double-12") return "home"; // legacy
  switch (initial.predictedWinner) {
    case "home":
      return "home";
    case "draw":
      return "draw";
    case "away":
      return "away";
    default:
      return null;
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
  const [view, setView] = useState<View>(initial ? "summary" : "type-picker");
  const [mode, setMode] = useState<Mode | null>(initial ? modeFromKind(initial.kind) : null);
  const [winnerOpt, setWinnerOpt] = useState<WinnerOptionId | null>(
    winnerOptionFromInitial(initial),
  );
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
  const [savedInitial, setSavedInitial] = useState<InitialPrediction | null>(initial);
  const [pending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const winnerOptions = buildWinnerOptions(stage, homeTeamName, awayTeamName, {
    teamWins: (team) => t("option.teamWins", { team }),
    draw: t("option.draw"),
    teamOrDraw: (team) => t("option.teamOrDraw", { team }),
    bonusSimple: t("bonus.simple"),
    bonusDouble: t("bonus.double"),
  });

  function handleSelectMode(next: Mode) {
    setMode(next);
    setView("options");
    setErrorCode(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorCode(null);
    startTransition(async () => {
      let payload: {
        matchId: string;
        kind: PredictionKind;
        predictedWinner: PredictionWinner | null;
        predictedHomeScore: number | null;
        predictedAwayScore: number | null;
      } | null = null;

      if (mode === "exact") {
        payload = {
          matchId,
          kind: "exact",
          predictedWinner: null,
          predictedHomeScore: home === "" ? null : Number(home),
          predictedAwayScore: away === "" ? null : Number(away),
        };
      } else if (mode === "winner") {
        const opt = winnerOptions.find((o) => o.id === winnerOpt);
        if (!opt) {
          setErrorCode("simple_missing_winner");
          return;
        }
        payload = {
          matchId,
          kind: opt.kind,
          predictedWinner: opt.winner,
          predictedHomeScore: null,
          predictedAwayScore: null,
        };
      }

      if (!payload) return;
      const result = await onSubmit(payload);
      if (result.ok) {
        setSavedInitial({
          kind: payload.kind,
          predictedWinner: payload.predictedWinner,
          predictedHomeScore: payload.predictedHomeScore,
          predictedAwayScore: payload.predictedAwayScore,
        });
        setView("summary");
      } else {
        setErrorCode(result.code);
      }
    });
  }

  if (view === "summary" && savedInitial) {
    return (
      <PredictionSummaryCard
        prediction={savedInitial}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        onEdit={() => {
          setMode(modeFromKind(savedInitial.kind));
          setView("type-picker");
        }}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border-2 border-border bg-card px-4 py-5 sm:px-5"
    >
      <h2 className="mb-1 font-display text-base text-gold">
        {savedInitial ? t("titleEdit") : t("titleNew")}
      </h2>
      <p className="mb-4 text-[12px] font-bold leading-snug text-muted">{t("subtitle")}</p>

      {view === "type-picker" && (
        <TypePicker
          onPick={handleSelectMode}
          activeMode={mode}
          maxSimple={basePointsForKind("simple")}
          maxExact={basePointsForKind("exact")}
        />
      )}

      {view === "options" && mode === "winner" && (
        <>
          <ModeBreadcrumb mode="winner" onChange={() => setView("type-picker")} />
          <fieldset
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            aria-label={t("optionsLabel")}
          >
            <legend className="sr-only">{t("optionsLabel")}</legend>
            {winnerOptions.map((opt) => (
              <WinnerTile
                key={opt.id}
                option={opt}
                selected={opt.id === winnerOpt}
                onSelect={() => setWinnerOpt(opt.id)}
              />
            ))}
          </fieldset>
        </>
      )}

      {view === "options" && mode === "exact" && (
        <>
          <ModeBreadcrumb mode="exact" onChange={() => setView("type-picker")} />
          <ExactInputs
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            home={home}
            away={away}
            onHome={setHome}
            onAway={setAway}
          />
          <p className="mt-2 text-center text-[11px] font-bold text-muted">💎 {t("bonus.exact")}</p>
        </>
      )}

      {errorCode && (
        <p className="mt-4 rounded-md border-[1.5px] border-danger/30 bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger">
          {errorCode in KNOWN_ERROR_CODES
            ? t(`errors.${errorCode as keyof typeof KNOWN_ERROR_CODES}`)
            : t("errors.fallback")}
        </p>
      )}

      {view === "options" && (
        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full cursor-pointer rounded-[10px] border-2 border-gold bg-gold/15 px-4 py-3 text-sm font-extrabold text-gold transition-colors hover:bg-gold/25 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? t("submitting") : savedInitial ? t("submitEdit") : t("submitNew")}
        </button>
      )}
    </form>
  );
}

function TypePicker({
  onPick,
  activeMode,
  maxSimple,
  maxExact,
}: {
  onPick: (m: Mode) => void;
  activeMode: Mode | null;
  maxSimple: number;
  maxExact: number;
}) {
  const t = useTranslations("predictions.type");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TypeTile
        emoji="🎯"
        title={t("winner")}
        subtitle={t("winnerHint")}
        bonus={t("winnerBonus", { points: maxSimple })}
        active={activeMode === "winner"}
        onClick={() => onPick("winner")}
      />
      <TypeTile
        emoji="💎"
        title={t("exact")}
        subtitle={t("exactHint")}
        bonus={t("exactBonus", { points: maxExact })}
        active={activeMode === "exact"}
        onClick={() => onPick("exact")}
      />
    </div>
  );
}

function TypeTile({
  emoji,
  title,
  subtitle,
  bonus,
  active,
  onClick,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  bonus: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex cursor-pointer flex-col gap-2 rounded-2xl border-2 px-4 py-4 text-start transition-colors ${
        active
          ? "border-gold bg-gold/10"
          : "border-border bg-card hover:border-gold/40 hover:bg-card-hover"
      }`}
    >
      <span aria-hidden="true" className="text-3xl">
        {emoji}
      </span>
      <span
        className={`font-display text-base leading-tight ${active ? "text-gold" : "text-foreground"}`}
      >
        {title}
      </span>
      <span className="text-[11px] font-bold leading-snug text-muted">{subtitle}</span>
      <span
        className={`mt-1 inline-flex w-fit items-center rounded-md border-[1.5px] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] ${
          active
            ? "border-gold/40 bg-gold/10 text-gold"
            : "border-border bg-white/[0.04] text-muted"
        }`}
      >
        {bonus}
      </span>
    </button>
  );
}

function ModeBreadcrumb({ mode, onChange }: { mode: Mode; onChange: () => void }) {
  const t = useTranslations("predictions");
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">
        {mode === "exact" ? `💎 ${t("type.exact")}` : `🎯 ${t("type.winner")}`}
      </span>
      <button
        type="button"
        onClick={onChange}
        className="cursor-pointer text-[11px] font-extrabold text-gold hover:underline"
      >
        {t("changeType")} →
      </button>
    </div>
  );
}

function WinnerTile({
  option,
  selected,
  onSelect,
}: {
  option: WinnerOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      // biome-ignore lint/a11y/useSemanticElements: <button role=radio> mantiene el styling de chip.
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
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.06em] ${
            selected ? "text-gold/70" : "text-muted"
          }`}
        >
          {option.bonus}
        </span>
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
    <div className="rounded-xl border-[1.5px] border-gold/30 bg-gold/[0.04] px-3 py-4">
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

/**
 * Card resumen tras enviar predicción (o al cargar si ya existía).
 * Muestra la predicción + bonus potencial + botón "Editar".
 */
function PredictionSummaryCard({
  prediction,
  homeTeamName,
  awayTeamName,
  onEdit,
}: {
  prediction: InitialPrediction;
  homeTeamName: string;
  awayTeamName: string;
  onEdit: () => void;
}) {
  const t = useTranslations("predictions");
  const tSum = useTranslations("predictions.summary");
  const points = basePointsForKind(prediction.kind);
  const emoji = prediction.kind === "exact" ? "💎" : prediction.kind === "simple" ? "🎯" : "⚡";
  const summary = formatSummary(prediction, homeTeamName, awayTeamName, tSum);

  return (
    <article className="mt-4 rounded-2xl border-2 border-success/30 bg-success/[0.06] px-4 py-5 sm:px-5">
      <div className="mb-2 inline-flex items-center gap-1 rounded-full border-[1.5px] border-success/40 bg-success/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-success">
        ✓ {t("summary.saved")}
      </div>
      <h2 className="mb-1 font-display text-lg leading-tight text-foreground">{summary}</h2>
      <p className="mb-4 text-[12px] font-bold text-muted">
        {emoji} {t("summary.potential", { points })}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-gold/40 bg-card px-3.5 py-1.5 text-xs font-extrabold text-gold transition-colors hover:border-gold hover:bg-gold/10"
      >
        ✎ {t("summary.edit")}
      </button>
    </article>
  );
}

function formatSummary(
  p: InitialPrediction,
  home: string,
  away: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (p.kind) {
    case "exact":
      return t("exact", {
        home,
        away,
        homeScore: p.predictedHomeScore ?? 0,
        awayScore: p.predictedAwayScore ?? 0,
      });
    case "simple":
      if (p.predictedWinner === "home") return t("teamWins", { team: home });
      if (p.predictedWinner === "away") return t("teamWins", { team: away });
      return t("draw");
    case "double-1x":
      return t("teamOrDraw", { team: home });
    case "double-x2":
      return t("teamOrDraw", { team: away });
    case "double-12":
      return `${home} / ${away}`;
  }
}
