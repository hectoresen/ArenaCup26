"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
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
 *
 * Patrón **preview + commit**: clicar un emoji solo lo marca como
 * "seleccionado" en el state local (`draft`). El user confirma con
 * "Guardar" o aborta con "Descartar". Esto evita cambios accidentales
 * y consume el cooldown solo cuando hay intención clara.
 */
export function AvatarPicker({
  trigger,
  currentAvatarId,
  hasGoogleImage,
  cooldownRemainingMs,
}: Props) {
  const t = useTranslations("profileEditor");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(currentAvatarId);
  const [isPending, startTransition] = useTransition();
  // Portal flag: durante SSR no hay document, hidratamos a client.
  // Sin esto el modal renderiza dentro del ProfileHero, que tiene
  // animación con `transform` y por spec CSS captura el `position:fixed`
  // del modal a su propio bounding box en vez del viewport. Sintoma
  // observado: avatar picker queda recortado dentro de la card en iOS.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const cooldownActive = (cooldownRemainingMs ?? 0) > 0;
  const cooldownMinutes = cooldownActive
    ? Math.max(1, Math.ceil((cooldownRemainingMs ?? 0) / 60_000))
    : 0;
  const isDirty = draft !== currentAvatarId;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  function discard() {
    setDraft(currentAvatarId);
    setOpen(false);
  }

  function save() {
    if (!isDirty) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await updateProfileAvatar(draft);
      if (result.ok) {
        setOpen(false);
        // Re-renderiza el layout para que AppAvatar del dropdown
        // se actualice (issue #8 del QA 2026-05-18).
        router.refresh();
      } else if (result.code === "cooldown") {
        const minutes = Math.max(1, Math.ceil((result.remainingMs ?? 0) / 60_000));
        setToast(t("cooldownToast", { minutes }));
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
            setToast(t("cooldownToast", { minutes: cooldownMinutes }));
            return;
          }
          // Reset draft al estado actual cada vez que se abre la modal
          // — si el user había cancelado antes con un draft a medias,
          // que no aparezca pre-seleccionado al reabrir.
          setDraft(currentAvatarId);
          setOpen(true);
        }}
        className="cursor-pointer border-0 bg-transparent p-0 transition-transform hover:scale-105"
        aria-label={
          cooldownActive
            ? t("cooldownAria", { minutes: cooldownMinutes })
            : t("changeAvatarAria")
        }
      >
        {trigger}
      </button>

      {open && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("avatarPickerTitle")}
          className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4 [animation:fadeUp_0.2s_ease_forwards]"
          onClick={(e) => {
            if (e.target === e.currentTarget) discard();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") discard();
          }}
        >
          {/* Mobile: full-screen, header/footer fijos, body scrollable.
              Desktop (≥ sm): modal centrada, max-w-md, mismo look que
              antes — el redoneado/border/sombra solo aplica en ≥sm.
              `dvh` (en vez de vh) descuenta el chrome del navegador
              en mobile, así el footer nunca queda detrás del URL bar. */}
          <div className="flex h-[100dvh] w-full flex-col bg-card sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl sm:border-2 sm:border-gold/30 sm:shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
            <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 sm:border-0 sm:px-5 sm:pb-3 sm:pt-5">
              <h2 className="font-display text-lg text-gold">{t("avatarPickerTitle")}</h2>
              <button
                type="button"
                onClick={discard}
                className="cursor-pointer rounded-full border-2 border-border bg-card-hover px-2 py-0.5 text-xs font-extrabold text-muted hover:border-gold/30 hover:text-foreground"
                aria-label={t("close")}
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div
                role="radiogroup"
                aria-label={t("avatarPickerTitle")}
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                {AVATAR_GALLERY.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={draft === a.id}
                    aria-label={a.label}
                    onClick={() => setDraft(a.id)}
                    disabled={isPending}
                    className={`group/avatar flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2.5 transition-all disabled:cursor-wait disabled:opacity-60 ${
                      draft === a.id
                        ? "border-gold bg-gold/[0.12] scale-[1.02] cursor-pointer"
                        : "border-border bg-card-hover hover:border-gold/40 hover:scale-[1.02] cursor-pointer"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.src}
                      alt=""
                      width={96}
                      height={96}
                      className="h-full w-full max-w-[96px] rounded-full"
                      loading="lazy"
                    />
                    <span className="font-display text-[11px] uppercase tracking-[0.08em] text-foreground">
                      {a.label}
                    </span>
                  </button>
                ))}
              </div>

              {hasGoogleImage && (
                <div className="mt-4 border-t border-border pt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    disabled={isPending || draft === null}
                    className={`cursor-pointer rounded-full border-2 px-4 py-2 text-xs font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      draft === null
                        ? "border-gold bg-gold/[0.08] text-gold"
                        : "border-border bg-card-hover text-muted hover:border-gold/30 hover:text-foreground"
                    }`}
                  >
                    {draft === null ? t("usingGoogle") : t("backToGoogle")}
                  </button>
                </div>
              )}
            </div>

            {/* Footer sticky abajo. En mobile reserva padding extra para
                la safe area del iPhone (home indicator) — sin esto los
                botones quedaban tocando el borde inferior del dispositivo. */}
            <footer
              className="flex shrink-0 justify-end gap-2 border-t border-border px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:pb-4"
            >
              <button
                type="button"
                onClick={discard}
                disabled={isPending}
                className="cursor-pointer rounded-xl border-2 border-border bg-card-hover px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted transition-colors hover:border-gold/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("discard")}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isPending || !isDirty}
                className="cursor-pointer rounded-xl border-2 border-gold/40 bg-gold/10 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.1em] text-gold transition-colors hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? t("saving") : t("save")}
              </button>
            </footer>
          </div>
        </div>,
        document.body,
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
