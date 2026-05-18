"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateProfileAvatar } from "@/server/profile/actions";
import { AVATAR_GALLERY } from "@/server/profile/avatars";

type Props = {
  /** Trigger element (el avatar actual del user, clickable). */
  trigger: React.ReactNode;
  /** ID del avatar actual (`null` = de Google). */
  currentAvatarId: string | null;
  /** True si el user tiene imagen de Google disponible. */
  hasGoogleImage: boolean;
  /**
   * Si > 0, el cooldown de 48h sigue activo. Al hacer clic mostramos
   * toast en vez de abrir la modal. Si undefined o 0, comportamiento
   * normal.
   */
  cooldownRemainingMs?: number;
};

/**
 * Modal con la galería de avatares + opción "Volver al de Google".
 * Se invoca pulsando el trigger (típicamente el avatar actual del
 * user). Submit dispara la server action con cooldown 48h y muestra
 * toast si está bloqueado.
 */
export function AvatarPicker({
  trigger,
  currentAvatarId,
  hasGoogleImage,
  cooldownRemainingMs,
}: Props) {
  const t = useTranslations("profileEditor");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cooldownActive = (cooldownRemainingMs ?? 0) > 0;
  const cooldownHours = cooldownActive
    ? Math.ceil((cooldownRemainingMs ?? 0) / 3_600_000)
    : 0;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  function pick(avatarId: string | null) {
    if (avatarId === currentAvatarId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await updateProfileAvatar(avatarId);
      if (result.ok) {
        setOpen(false);
      } else if (result.code === "cooldown") {
        const hours = Math.ceil((result.remainingMs ?? 0) / 3_600_000);
        setToast(t("cooldownToast", { hours }));
      } else {
        setToast(t("genericError"));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (cooldownActive) {
            setToast(t("cooldownToast", { hours: cooldownHours }));
            return;
          }
          setOpen(true);
        }}
        className="cursor-pointer border-0 bg-transparent p-0 transition-transform hover:scale-105"
        aria-label={
          cooldownActive
            ? t("cooldownAria", { hours: cooldownHours })
            : t("changeAvatarAria")
        }
      >
        {trigger}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("avatarPickerTitle")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm [animation:fadeUp_0.2s_ease_forwards]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-gold/30 bg-card p-5 shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-gold">{t("avatarPickerTitle")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full border-2 border-border bg-card px-2 py-0.5 text-xs font-extrabold text-muted hover:border-gold/30 hover:text-foreground"
                aria-label={t("close")}
              >
                ✕
              </button>
            </header>

            <div
              role="radiogroup"
              aria-label={t("avatarPickerTitle")}
              className="grid grid-cols-6 gap-2 max-[420px]:grid-cols-4"
            >
              {AVATAR_GALLERY.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={currentAvatarId === a.id}
                  aria-label={a.label}
                  onClick={() => pick(a.id)}
                  disabled={isPending}
                  className={`flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-2 text-3xl transition-all disabled:cursor-wait disabled:opacity-60 ${
                    currentAvatarId === a.id
                      ? "border-gold bg-gold/[0.12] scale-105"
                      : "border-border bg-card-hover hover:border-gold/40 hover:scale-105"
                  }`}
                >
                  {a.emoji}
                </button>
              ))}
            </div>

            {hasGoogleImage && (
              <footer className="mt-4 border-t border-border pt-3 text-center">
                <button
                  type="button"
                  onClick={() => pick(null)}
                  disabled={isPending || currentAvatarId === null}
                  className="cursor-pointer rounded-full border-2 border-border bg-card px-4 py-2 text-xs font-extrabold text-muted transition-colors hover:border-gold/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {currentAvatarId === null ? t("usingGoogle") : t("backToGoogle")}
                </button>
              </footer>
            )}
          </div>
        </div>
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
