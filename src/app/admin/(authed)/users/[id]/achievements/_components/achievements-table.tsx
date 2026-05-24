"use client";

import {
  grantAchievementAction,
  revokeAchievementAction,
} from "@/server/admin/actions/achievements";
import type { AchievementRow } from "@/server/admin/user-achievements";
import { useState, useTransition } from "react";

const TIER_COLORS: Record<string, string> = {
  common: "border-slate-600 text-slate-300",
  uncommon: "border-emerald-500/40 text-emerald-300",
  epic: "border-sky-500/40 text-sky-300",
  legendary: "border-amber-500/40 text-amber-300",
  mythic: "border-rose-500/40 text-rose-300",
};

const TIER_LABELS: Record<string, string> = {
  common: "Común",
  uncommon: "Poco común",
  epic: "Épico",
  legendary: "Legendario",
  mythic: "Mítico",
};

const DATE_FMT = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function AchievementsTable({
  userId,
  achievements,
}: {
  userId: string;
  achievements: AchievementRow[];
}) {
  // tier filter
  const [tierFilter, setTierFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unlocked" | "locked">("all");

  const filtered = achievements.filter((a) => {
    if (tierFilter !== "all" && a.tier !== tierFilter) return false;
    if (statusFilter === "unlocked" && a.unlockedAt === null) return false;
    if (statusFilter === "locked" && a.unlockedAt !== null) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Filter
          label="Tier"
          value={tierFilter}
          options={["all", "common", "uncommon", "epic", "legendary", "mythic"]}
          labels={{ all: "Todos", ...TIER_LABELS }}
          onChange={(v) => setTierFilter(v)}
        />
        <Filter
          label="Estado"
          value={statusFilter}
          options={["all", "unlocked", "locked"]}
          labels={{ all: "Todos", unlocked: "Desbloqueados", locked: "Bloqueados" }}
          onChange={(v) => setStatusFilter(v as "all" | "unlocked" | "locked")}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            No hay logros con esos filtros.
          </p>
        ) : (
          <ul className="m-0 divide-y divide-slate-800 list-none p-0">
            {filtered.map((a) => (
              <AchievementRowItem key={a.id} userId={userId} achievement={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AchievementRowItem({
  userId,
  achievement,
}: {
  userId: string;
  achievement: AchievementRow;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const isUnlocked = achievement.unlockedAt !== null;
  const tierClasses = TIER_COLORS[achievement.tier] ?? TIER_COLORS.common;

  function grant() {
    setFeedback(null);
    startTransition(async () => {
      const r = await grantAchievementAction({ userId, achievementId: achievement.id });
      if (r.ok) setFeedback({ kind: "ok", text: "Logro otorgado." });
      else setFeedback({ kind: "err", text: `Error: ${r.error}` });
    });
  }

  function revoke() {
    setFeedback(null);
    startTransition(async () => {
      const r = await revokeAchievementAction({ userId, achievementId: achievement.id });
      if (r.ok) setFeedback({ kind: "ok", text: "Logro retirado." });
      else setFeedback({ kind: "err", text: `Error: ${r.error}` });
    });
  }

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${isUnlocked ? "" : "opacity-60"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold text-slate-100">{achievement.title}</span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${tierClasses}`}
          >
            {TIER_LABELS[achievement.tier] ?? achievement.tier}
          </span>
          {isUnlocked && (
            <span className="rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-gold">
              Desbloqueado
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">{achievement.description}</p>
        {achievement.unlockedAt && (
          <p className="mt-0.5 text-[10px] text-slate-600">
            Conseguido {DATE_FMT.format(achievement.unlockedAt)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {feedback && (
          <span
            className={`text-[10px] font-bold ${
              feedback.kind === "ok" ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {feedback.text}
          </span>
        )}
        {isUnlocked ? (
          <button
            type="button"
            onClick={revoke}
            disabled={pending}
            className="cursor-pointer rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
          >
            {pending ? "…" : "Retirar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={grant}
            disabled={pending}
            className="cursor-pointer rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {pending ? "…" : "Otorgar"}
          </button>
        )}
      </div>
    </li>
  );
}

function Filter<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  labels: Record<string, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`cursor-pointer rounded-md border px-2 py-0.5 text-[11px] font-bold transition-colors ${
              opt === value
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-slate-100"
            }`}
          >
            {labels[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}
