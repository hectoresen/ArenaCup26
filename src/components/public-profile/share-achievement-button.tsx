"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Props = {
  /** username del dueño del logro — vuela hacia la URL pública del perfil. */
  ownerUsername: string;
  /** ID del logro (slug del catálogo) — sirve de anchor `#ach-<id>`. */
  achievementId: string;
  /** Título humano del logro, para el share sheet nativo y el mensaje. */
  achievementTitle: string;
  /** Tier-aware className que pasa la card (color del chip). */
  className: string;
};

/**
 * Botón de "Compartir logro" para los tier legendary/mythic/goat.
 *
 * Estrategia híbrida:
 *  1. Si el browser soporta `navigator.share` (móvil moderno + Safari
 *     desktop), abre el share-sheet nativo — el OS elige el target
 *     (WhatsApp, Telegram, Twitter, AirDrop, …). Si el user cancela,
 *     navigator.share rechaza con `AbortError` y NO mostramos toast
 *     (el cancel ya es feedback claro).
 *  2. Si el browser NO soporta Web Share API (Chrome desktop, Firefox
 *     desktop, etc.), copia la URL al portapapeles y muestra un toast.
 *  3. Si todo falla (clipboard rechazado por permission policy, etc.),
 *     toast de error.
 *
 * La URL es absoluta (`window.location.origin` + path sin locale) para
 * que cualquier destinatario aterrice y next-intl le sirva su idioma.
 */
export function ShareAchievementButton({
  ownerUsername,
  achievementId,
  achievementTitle,
  className,
}: Props) {
  const t = useTranslations("publicProfile.share");
  const [toast, setToast] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Auto-hide del toast tras 2.5s — suficiente para leer "Enlace copiado"
  // sin entorpecer; el user puede pulsar otra acción inmediatamente.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  async function handleClick() {
    const url = `${window.location.origin}/u/${ownerUsername}#ach-${achievementId}`;
    const shareTitle = t("title", { name: achievementTitle });
    const shareText = t("text", { name: achievementTitle });

    // 1) Web Share API
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      } catch (err) {
        // AbortError = user canceló el share sheet; no es fallo.
        if (err instanceof Error && err.name === "AbortError") return;
        // Otros errores: continuamos al fallback de clipboard.
      }
    }

    // 2) Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      setToast({ tone: "success", text: t("copied") });
    } catch {
      setToast({ tone: "error", text: t("copyFailed") });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`${className} cursor-pointer border-0`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <use href="#ach-share" />
        </svg>
        {t("shareLabel")}
      </button>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed start-1/2 top-4 z-[100] max-w-[92vw] -translate-x-1/2 rounded-2xl border-2 px-4 py-3 text-center text-[12px] font-extrabold shadow-[0_8px_24px_rgba(0,0,0,0.45)] [animation:fadeUp_0.2s_ease_forwards] ${
            toast.tone === "success"
              ? "border-gold/40 bg-card-hover text-gold"
              : "border-danger/40 bg-card-hover text-danger"
          }`}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
