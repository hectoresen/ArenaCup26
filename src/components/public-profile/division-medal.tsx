import type { Division } from "@/lib/leaderboard/division";
import { useTranslations } from "next-intl";

type Props = {
  division: Division;
};

/**
 * Medalla de división mostrada en la esquina superior derecha del
 * `<ProfileHero>`. Refleja el ranking ACTUAL del owner — derivado y
 * sin persistencia, por lo que es reversible (cae con el rank).
 *
 * Diseño:
 *  - SVG 44×44 en estilo del sprite de logros: pendant circular + cinta
 *    en V + ornamento central distinto por división. Sin emoji.
 *  - Color via `var(--color-gold/silver/bronze)` (mismos tokens que las
 *    líneas divisorias del leaderboard) → el día que se redefina la
 *    paleta, las medallas la acompañan sin tocar este componente.
 *  - Copy debajo, minimalista, i18n por locale.
 *
 * Documentación: `docs/divisions.md` §Medalla en el perfil.
 */
export function DivisionMedal({ division }: Props) {
  const t = useTranslations("publicProfile.medal");
  const cfg = MEDAL_CONFIG[division];
  return (
    <div
      data-testid={`division-medal-${division}`}
      data-division={division}
      aria-label={t("aria", { division: t(`labels.${division}`) })}
      className="inline-flex flex-col items-center gap-1"
      style={{ color: cfg.color }}
    >
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        aria-hidden="true"
        style={{ filter: `drop-shadow(0 0 6px ${cfg.color}66)` }}
      >
        {/* Cinta en V (dos tiras simétricas que entran al pendant
            por la parte superior). Stroke-only para coherencia con
            el resto del sprite. */}
        <path
          d="M14 4 L22 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M30 4 L22 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Pendant: círculo principal + anillo interior decorativo. */}
        <circle
          cx="22"
          cy="28"
          r="12"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="22"
          cy="28"
          r="8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.55"
        />
        {/* Ornamento central distinto por división — funciona también
            en modo grayscale (accesibilidad y screenshots). */}
        {cfg.ornament}
      </svg>
      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] leading-none">
        {t(`labels.${division}`)}
      </span>
    </div>
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
  // Bronce: una sola hoja simple — tercero, ornamento más austero.
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
