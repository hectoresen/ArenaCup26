"use client";

import { useEffect, useState } from "react";

const COUNT = 7;

/**
 * Decoración de fondo: 7 balones ⚽ flotando hacia arriba en bucle
 * (animación `floatUp` ya definida en globals.css).
 *
 * Reglas:
 * - Si el usuario tiene `prefers-reduced-motion: reduce`, **no se
 *   monta nada** (no añade nodos al DOM).
 * - Se monta sólo en cliente para que SSR no parpadee con nodos que
 *   inmediatamente desaparecen.
 */
export function Floaters() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {Array.from({ length: COUNT }).map((_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: 7 fijos, no cambia.
          key={i}
          aria-hidden="true"
          className="fixed pointer-events-none z-0 motion-safe:[animation:floatUp_linear_infinite]"
          style={{
            left: `${3 + i * 14}vw`,
            opacity: 0.055,
            fontSize: `${10 + ((i * 7) % 14)}px`,
            animationDuration: `${22 + ((i * 11) % 20)}s`,
            animationDelay: `${-((i * 13) % 24)}s`,
          }}
        >
          ⚽
        </span>
      ))}
    </>
  );
}
