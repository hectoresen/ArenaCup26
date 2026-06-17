"use client";

import type { Division } from "@/lib/leaderboard/division";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  division: Division;
};

/**
 * Medalla de división mostrada en la esquina superior derecha del
 * `<ProfileHero>`. Refleja el ranking ACTUAL del owner — derivado y
 * sin persistencia, por lo que es reversible (cae con el rank).
 *
 * Click → abre un modal explicativo (qué es la medalla, cómo se gana,
 * que es reversible) con un link "Ver más" al apartado de divisiones
 * del FAQ. Modal pattern reutilizado de `NotificationModal`:
 * fixed inset-0 centrado, backdrop oscuro click-to-close, Escape
 * cierra. Touch-friendly y sin dependencia de portal.
 *
 * Diseño visual del SVG:
 *  - Pendant 44×44 con radialGradient para dar volumen (centro brillante,
 *    borde apagado) en lugar del fill plano original.
 *  - Specular highlight (elipse superior-izquierda al 35%) que simula
 *    reflejo de luz sobre metal pulido.
 *  - Cinta en V con doble tira (línea principal + sombra interior) para
 *    sugerir pliegue 3D.
 *  - Color via `var(--color-gold/silver/bronze)` con drop-shadow del
 *    mismo tono.
 *  - Ornamento central distinto por tier (estrella oro, laurel plata,
 *    palma bronce) — funciona también en grayscale.
 *
 * Documentación end-to-end: `docs/divisions.md` §Medalla en el perfil.
 */
export function DivisionMedal({ division }: Props) {
  const t = useTranslations("publicProfile.medal");
  const cfg = MEDAL_CONFIG[division];
  const gradId = useId();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const label = t(`labels.${division}`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`division-medal-${division}`}
        data-division={division}
        aria-label={t("popover.ariaTrigger", { division: label })}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="group inline-flex cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 transition-transform hover:scale-[1.06] active:scale-[0.97]"
        style={{ color: cfg.color }}
      >
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          aria-hidden="true"
          style={{ filter: `drop-shadow(0 2px 4px ${cfg.color}88)` }}
        >
          <defs>
            {/* Gradiente radial para el pendant: brillo en el centro
                superior-izquierdo, oscurece hacia el borde derecho-
                inferior. Da sensación de metal pulido. */}
            <radialGradient id={`${gradId}-grad`} cx="0.35" cy="0.32" r="0.85">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
            </radialGradient>
            {/* Specular highlight: elipse blanquecina superior-izquierda. */}
            <radialGradient id={`${gradId}-spec`} cx="0.3" cy="0.25" r="0.4">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Cinta en V con doble tira: la principal en currentColor +
              una sombra interior más oscura para el pliegue. */}
          <path
            d="M13 4 L21.5 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M14.5 4.5 L22 15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.95"
          />
          <path
            d="M31 4 L22.5 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M29.5 4.5 L22 15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.95"
          />

          {/* Pendant: anillo exterior (más oscuro) + fill con gradiente
              radial + ring interior decorativo + specular highlight. */}
          <circle
            cx="22"
            cy="28"
            r="12.5"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <circle cx="22" cy="28" r="11" fill={`url(#${gradId}-grad)`} />
          <circle
            cx="22"
            cy="28"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.9"
            opacity="0.6"
          />
          {/* Specular highlight encima del fill — debe ir antes del
              ornamento central para que el ornamento quede visible. */}
          <ellipse cx="17" cy="22" rx="8" ry="5" fill={`url(#${gradId}-spec)`} />

          {/* Ornamento central distinto por división. */}
          {cfg.ornament}
        </svg>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] leading-none transition-opacity group-hover:opacity-90">
          {label}
        </span>
      </button>

      {open && (
        <div
          // biome-ignore lint/a11y/useSemanticElements: <dialog> nativo requiere .showModal() imperativo; usamos overlay manual con role=dialog para coherencia con NotificationModal
          role="dialog"
          aria-modal="true"
          aria-labelledby={`medal-modal-title-${division}`}
          className="fixed inset-0 z-[80] grid place-items-center px-4 py-8"
        >
          <button
            type="button"
            aria-label={t("popover.closeAria")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-pointer border-0 bg-black/70 backdrop-blur-sm"
          />
          <div
            className="relative w-full max-w-md rounded-2xl border-2 bg-card text-foreground shadow-[0_24px_48px_rgba(0,0,0,0.6)] [animation:popIn_0.2s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
            style={{ borderColor: `${cfg.color}55` }}
          >
            <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span style={{ color: cfg.color }} className="shrink-0">
                  {/* SVG reducido para el header del modal — 28×28. */}
                  <svg width="28" height="28" viewBox="0 0 44 44" aria-hidden="true">
                    <circle
                      cx="22"
                      cy="22"
                      r="14"
                      fill="currentColor"
                      fillOpacity="0.18"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    />
                    <circle
                      cx="22"
                      cy="22"
                      r="10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.9"
                      opacity="0.6"
                    />
                    <g transform="translate(0, -6)">{cfg.ornament}</g>
                  </svg>
                </span>
                <h2
                  id={`medal-modal-title-${division}`}
                  className="font-display text-base"
                  style={{ color: cfg.color }}
                >
                  {label}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("popover.closeAria")}
                className="-mt-1 cursor-pointer rounded-md border border-border bg-card-hover px-2 py-1 text-[13px] font-black text-muted transition-colors hover:border-gold/40 hover:text-foreground"
              >
                ×
              </button>
            </header>
            <div className="px-5 py-4 text-[13px] leading-relaxed text-foreground">
              <p className="mb-2">{t(`popover.body.${division}`)}</p>
              <p className="text-muted">{t("popover.howItWorks")}</p>
            </div>
            <footer className="flex items-center justify-end border-t border-border px-5 py-3">
              <Link
                href="/faq#faq-divisions"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 rounded-md border-[1.5px] border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-gold no-underline transition-colors hover:border-gold/60 hover:bg-gold/15"
              >
                {t("popover.viewMore")} <span aria-hidden="true">→</span>
              </Link>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

type MedalConfig = { color: string; ornament: React.ReactNode };

const MEDAL_CONFIG: Record<Division, MedalConfig> = {
  // Oro: estrella de 5 puntas — máxima jerarquía.
  gold: {
    color: "var(--color-gold)",
    ornament: (
      <polygon
        points="22,21 23.6,26 28.8,26 24.6,29 26.2,34 22,31 17.8,34 19.4,29 15.2,26 20.4,26"
        fill="currentColor"
        opacity="0.95"
      />
    ),
  },
  // Plata: dos hojas de laurel cruzadas — segundo lugar clásico.
  silver: {
    color: "var(--color-silver)",
    ornament: (
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M16 30 Q19 24 22 22" />
        <path d="M28 30 Q25 24 22 22" />
        <circle cx="22" cy="22" r="1.6" fill="currentColor" />
      </g>
    ),
  },
  // Bronce: hoja simple — tercero, ornamento más austero.
  bronze: {
    color: "var(--color-bronze)",
    ornament: (
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M22 21 L22 33" strokeWidth="1.6" />
        <path d="M22 24 Q18 26 18 30" strokeWidth="1.4" />
        <path d="M22 24 Q26 26 26 30" strokeWidth="1.4" />
      </g>
    ),
  },
};
