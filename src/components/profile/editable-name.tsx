"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateProfileName } from "@/server/profile/actions";

type Props = {
  /**
   * Valor canónico — lo que vive en `users.name`. Cuando el user
   * entra en modo edición, este es el contenido del input. Es el
   * valor que se envía a la server action.
   */
  initial: string;
  /**
   * Lo que se muestra en modo no-edit. Útil cuando el hero del
   * dashboard quiere mostrar solo el primer nombre pero editar el
   * completo. Si se omite, se usa `initial`.
   */
  display?: string;
  /** Clases del span/input para mantener el estilo del contexto. */
  className?: string;
  /**
   * Si > 0, el cooldown de 48h sigue activo. Mostramos un hint
   * pequeño "Próximo cambio en Xh" y al clic mostramos toast en vez
   * de abrir el input. Si undefined o 0, comportamiento normal.
   */
  cooldownRemainingMs?: number;
};

/**
 * Nombre clickable que se vuelve input al pulsar. Submit (Enter o
 * blur) dispara la server action con cooldown 48h. Si falla por
 * cooldown muestra un toast 3s "Solo puedes cambiarlo cada 48h".
 *
 * Diseñado para reusarse en el saludo `/inicio` (que muestra
 * `firstName(userName)` pero edita el nombre completo) y en la card
 * de identidad de `/u/<username>` (cuando el viewer es el dueño).
 */
export function EditableName({ initial, display, className, cooldownRemainingMs }: Props) {
  const t = useTranslations("profileEditor");
  const [name, setName] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownActive = (cooldownRemainingMs ?? 0) > 0;
  const cooldownHours = cooldownActive
    ? Math.ceil((cooldownRemainingMs ?? 0) / 3_600_000)
    : 0;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === name || trimmed.length === 0) {
      setEditing(false);
      setDraft(name);
      return;
    }
    startTransition(async () => {
      const result = await updateProfileName(trimmed);
      if (result.ok) {
        setName(trimmed);
        setEditing(false);
      } else if (result.code === "cooldown") {
        const hours = Math.ceil((result.remainingMs ?? 0) / 3_600_000);
        setToast(t("cooldownToast", { hours }));
        setEditing(false);
        setDraft(name);
      } else {
        setToast(t("genericError"));
        setEditing(false);
        setDraft(name);
      }
    });
  }

  if (!editing) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            if (cooldownActive) {
              setToast(t("cooldownToast", { hours: cooldownHours }));
              return;
            }
            setEditing(true);
          }}
          className={`cursor-pointer border-0 bg-transparent p-0 text-inherit transition-opacity hover:opacity-80 ${className ?? ""}`}
          aria-label={
            cooldownActive
              ? t("cooldownAria", { hours: cooldownHours })
              : t("editAria", { name })
          }
        >
          {display ?? name}
        </button>
        {cooldownActive && (
          <span className="ms-2 inline-flex items-center gap-1 align-middle text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
            <svg
              width="9"
              height="9"
              viewBox="0 0 12 12"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="6" cy="6" r="5" />
              <path d="M6 3 v3 l2 1.5" strokeLinecap="round" />
            </svg>
            {t("cooldownHint", { hours: cooldownHours })}
          </span>
        )}
        {toast && (
          <div
            role="status"
            className="fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-2xl border-2 border-warm/30 bg-card-hover px-4 py-2 text-[12px] font-extrabold text-warm shadow-[0_8px_24px_rgba(0,0,0,0.45)] [animation:fadeUp_0.2s_ease_forwards]"
          >
            {toast}
          </div>
        )}
      </>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setEditing(false);
          setDraft(name);
        }
      }}
      maxLength={60}
      disabled={isPending}
      className={`min-w-0 rounded-md border-2 border-gold/50 bg-card-hover px-2 py-0.5 outline-none focus:border-gold ${className ?? ""}`}
    />
  );
}
