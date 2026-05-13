"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Copia `window.location.href` al clipboard y muestra un toast
 * "Copiado" durante 2s. Si la API no está disponible (navegador
 * antiguo, contexto no-secure), degrada silenciosamente sin error.
 */
export function CopyLinkButton({ className }: { className?: string }) {
  const t = useTranslations("publicProfile");
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — el botón no falla visualmente; el user puede copiar la URL a mano.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t("copyLink")}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-gold/30 bg-card/80 px-3 py-1 text-xs font-extrabold text-gold transition-colors hover:border-gold/60 hover:bg-card-hover/80 ${className ?? ""}`}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6 5 V3 a1 1 0 0 1 1-1 h6 a1 1 0 0 1 1 1 v8 a1 1 0 0 1 -1 1 h-2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
      {copied ? t("copied") : t("copyLink")}
    </button>
  );
}
