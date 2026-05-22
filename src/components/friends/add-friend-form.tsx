"use client";

import { sendFriendRequest } from "@/server/friends/actions";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

/**
 * Mini-form para enviar solicitud por @username. Optimistic: deshabilita
 * el botón mientras envía y muestra mensaje de éxito/error inline. No
 * abre modal: input + botón en una línea.
 */
export function AddFriendForm() {
  const t = useTranslations("friends.addForm");
  const [username, setUsername] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim().replace(/^@/, "");
    if (!trimmed) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await sendFriendRequest(trimmed);
      if (result.ok) {
        setFeedback({ kind: "ok", text: t("feedback.ok") });
        setUsername("");
        return;
      }
      const errorKey = `feedback.error.${result.code}` as
        | "feedback.error.unauthorized"
        | "feedback.error.user_not_found"
        | "feedback.error.self"
        | "feedback.error.already_pending"
        | "feedback.error.already_friends"
        | "feedback.error.blocked";
      setFeedback({ kind: "error", text: t(errorKey) });
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border-2 border-border bg-card p-4">
      <label
        htmlFor="add-friend-username"
        className="mb-2 block font-display text-[12px] uppercase tracking-[0.12em] text-gold"
      >
        {t("label")}
      </label>
      <div className="flex items-center gap-2">
        <input
          id="add-friend-username"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("placeholder")}
          className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold text-foreground placeholder:font-bold placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending || username.trim().length === 0}
          className="cursor-pointer rounded-xl border-2 border-gold/40 bg-gold/10 px-4 py-2 text-sm font-extrabold text-gold transition-colors hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? t("sending") : t("submit")}
        </button>
      </div>
      {feedback && (
        <p
          className={`mt-2 text-[12px] font-bold ${
            feedback.kind === "ok" ? "text-success" : "text-danger"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </form>
  );
}
