"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** `danger` pinta el CTA en rojo; `default` lo deja en gold. */
  variant?: "danger" | "default";
  /** Deshabilita el CTA mientras hay request en vuelo. */
  isPending?: boolean;
};

/**
 * Modal de confirmación genérico para acciones destructivas
 * (eliminar amigo, revocar invitación, etc.). Reemplaza al
 * `window.confirm()` nativo del navegador para mantener el look
 * & feel de la app.
 *
 * Misma maquetación que `AvatarPicker`: backdrop con blur, panel
 * con borde gold, cierre por click-outside o tecla Escape, y
 * focus inicial en el botón "Cancelar" para que `Enter` no
 * dispare la acción destructiva sin querer.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = "default",
  isPending = false,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15"
      : "border-gold/40 bg-gold/10 text-gold hover:bg-gold/15";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-body"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm [animation:fadeUp_0.2s_ease_forwards]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !isPending) onCancel();
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border-2 border-gold/30 bg-card p-5 shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
        <h2 id="confirm-dialog-title" className="mb-2 font-display text-lg text-gold">
          {title}
        </h2>
        <p
          id="confirm-dialog-body"
          className="mb-5 text-[13px] font-bold leading-relaxed text-muted"
        >
          {body}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="cursor-pointer rounded-xl border-2 border-border bg-card-hover px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted transition-colors hover:border-gold/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`cursor-pointer rounded-xl border-2 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.1em] transition-colors disabled:cursor-wait disabled:opacity-50 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
