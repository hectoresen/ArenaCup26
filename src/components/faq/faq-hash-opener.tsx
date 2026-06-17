"use client";

import { useEffect } from "react";

/**
 * Pequeño helper client-side que, al cargar la página `/faq`,
 * comprueba `window.location.hash` y abre el `<details>` correspondiente
 * si existe (`#faq-divisions` → abre el FaqItem con `id="faq-divisions"`).
 *
 * Sin esto el ancla del browser scrollea hasta la pregunta pero la deja
 * cerrada — el user tiene que pulsar el chevron para verla. Con esto,
 * llegas vía deep-link y la respuesta YA está visible.
 *
 * Solo corre una vez al mount: no escucha cambios de hash posteriores
 * (no es navegación SPA dentro del FAQ).
 */
export function FaqHashOpener() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el && el.tagName === "DETAILS" && !el.hasAttribute("open")) {
      el.setAttribute("open", "");
      // El navegador ya hace scroll al ancla; con `scroll-mt-24` en el
      // FaqItem dejamos espacio para el TopChrome y la pregunta queda
      // visible en lugar de cortada arriba.
    }
  }, []);
  return null;
}
