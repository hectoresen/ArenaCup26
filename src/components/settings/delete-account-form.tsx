"use client";

import { useRouter } from "@/i18n/navigation";
import { deleteAccount } from "@/server/users/delete-account";
import { DELETE_CONFIRMATION_PHRASE } from "@/server/users/delete-account-constants";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

/**
 * Formulario de borrado de cuenta. Doble confirmación:
 *  1. Toggle "Sí, quiero eliminar mi cuenta" (checkbox).
 *  2. Input que exige escribir literalmente la frase canónica.
 *
 * El botón "Eliminar" solo se habilita cuando ambos gates pasan,
 * evitando borrados accidentales por enter o click.
 *
 * Tras éxito: signOut (server-side ya hecho) + redirect a la
 * landing pública. El user verá "/" sin sesión.
 */
export function DeleteAccountForm() {
  const t = useTranslations("settings.deleteAccount");
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const phraseMatches = confirm.trim() === DELETE_CONFIRMATION_PHRASE;
  const canSubmit = agreed && phraseMatches && !isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(confirm);
      if (!result.ok) {
        setError(
          t(
            `error.${result.code}` as
              | "error.unauthorized"
              | "error.confirmation_mismatch",
          ),
        );
        return;
      }
      // Redirect a la landing. El server ya hizo signOut, pero el
      // cliente todavía tiene cache de la página actual — usamos
      // router.replace + refresh para forzar SSR limpio sin la
      // sesión.
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-[12px] font-bold leading-snug text-foreground/90">{t("intro")}</p>
      <ul className="list-disc space-y-1 ps-5 text-[12px] font-bold leading-snug text-muted">
        <li>{t("bullets.predictions")}</li>
        <li>{t("bullets.friends")}</li>
        <li>{t("bullets.achievements")}</li>
        <li>{t("bullets.history")}</li>
      </ul>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-border bg-card p-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 accent-danger"
        />
        <span className="text-[12px] font-extrabold text-foreground">{t("agreeLabel")}</span>
      </label>

      <div>
        <label
          htmlFor="delete-confirm-input"
          className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted"
        >
          {t.rich("confirmLabel", {
            phrase: () => (
              <span className="font-display text-danger">
                {DELETE_CONFIRMATION_PHRASE}
              </span>
            ),
          })}
        </label>
        <input
          id="delete-confirm-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={DELETE_CONFIRMATION_PHRASE}
          className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 font-display text-[14px] tracking-wider text-foreground focus:border-danger/60 focus:outline-none"
        />
      </div>

      {error && <p className="text-[12px] font-extrabold text-danger">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full cursor-pointer rounded-xl border-2 border-danger/40 bg-danger/10 px-4 py-3 font-display text-[14px] uppercase tracking-[0.1em] text-danger transition-colors hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
