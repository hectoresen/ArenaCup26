"use client";

import { useState, useTransition } from "react";
import { toggleMaintenance } from "./actions";

export function MaintenanceForm(props: { initialEnabled: boolean; initialMessage: string }) {
  const [enabled, setEnabled] = useState(props.initialEnabled);
  const [message, setMessage] = useState(props.initialMessage);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await toggleMaintenance({
        enabled,
        message: message.trim().length > 0 ? message.trim() : null,
      });
      if (result.ok) {
        setFeedback({ kind: "ok", text: "Guardado." });
      } else {
        setFeedback({ kind: "err", text: `Error: ${result.error}` });
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-rose-500"
        />
        <span className="text-sm font-bold text-slate-100">Activar modo mantenimiento</span>
      </label>

      <div>
        <label
          htmlFor="maintenance-message"
          className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400"
        >
          Mensaje del banner (opcional)
        </label>
        <textarea
          id="maintenance-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Estamos haciendo mejoras. Volvemos en breve."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
        />
        <div className="mt-1 text-right text-[11px] text-slate-500">{message.length}/280</div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-bold text-gold transition-colors hover:border-gold hover:bg-gold/20 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {feedback && (
          <span
            className={
              feedback.kind === "ok"
                ? "text-xs font-bold text-emerald-300"
                : "text-xs font-bold text-rose-300"
            }
          >
            {feedback.text}
          </span>
        )}
      </div>
    </form>
  );
}
