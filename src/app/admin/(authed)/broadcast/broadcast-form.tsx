"use client";

import { useState, useTransition } from "react";
import { sendBroadcast } from "./actions";

export function BroadcastForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await sendBroadcast({
        title: title.trim(),
        body: body.trim().length > 0 ? body.trim() : null,
      });
      if (result.ok) {
        setFeedback({
          kind: "ok",
          text: `Enviado a ${result.recipients} usuarios.`,
        });
        setTitle("");
        setBody("");
      } else {
        setFeedback({ kind: "err", text: `Error: ${result.error}` });
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label
          htmlFor="broadcast-title"
          className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400"
        >
          Título (obligatorio)
        </label>
        <input
          id="broadcast-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          required
          placeholder="¡Empieza el Mundial!"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
        />
        <div className="mt-1 text-right text-[11px] text-slate-500">{title.length}/140</div>
      </div>

      <div>
        <label
          htmlFor="broadcast-body"
          className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400"
        >
          Cuerpo (opcional)
        </label>
        <textarea
          id="broadcast-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Texto del cuerpo de la notificación…"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
        />
        <div className="mt-1 text-right text-[11px] text-slate-500">{body.length}/500</div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending || title.trim().length === 0}
          className="cursor-pointer rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-bold text-gold transition-colors hover:border-gold hover:bg-gold/20 disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Enviar"}
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
