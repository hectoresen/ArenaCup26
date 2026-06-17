type Tier = "gold" | "silver" | "bronze";

/**
 * Divisor visual sin texto que separa el ranking en tramos de 10
 * posiciones (1-10 oro, 11-20 plata, 21-30 bronce). Se inserta justo
 * después de la fila del puesto 10, 20 y 30. Como es puramente
 * decorativo, lleva `aria-hidden` — el rank de cada usuario ya es
 * texto leíble y suficiente para SR.
 *
 * Color y glow vienen de los design tokens `--color-gold`,
 * `--color-silver` y `--color-bronze` definidos en `globals.css`,
 * para que un cambio de paleta los acompañe sin tocar este componente.
 */
export function LeagueDivider({ tier }: { tier: Tier }) {
  const tone = TIER_TONES[tier];
  return (
    <div
      aria-hidden="true"
      data-testid={`league-divider-${tier}`}
      className="my-[6px] flex items-center gap-3"
    >
      <span
        className="h-[2px] flex-1 rounded-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${tone}A6 50%, transparent)`,
        }}
      />
      <span
        className="relative inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full"
        style={{ color: tone }}
      >
        {/* Halo blureado detrás de la gema para reforzar el color. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full opacity-30 blur-[7px]"
          style={{ background: tone }}
        />
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          className="relative z-[1]"
          style={{ filter: `drop-shadow(0 0 3px ${tone})` }}
        >
          <polygon
            points="12,2 20,9 12,22 4,9"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M4 9 L20 9 M12 2 L8.5 9 M12 2 L15.5 9"
            stroke="currentColor"
            strokeWidth="1.1"
            opacity="0.85"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        className="h-[2px] flex-1 rounded-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${tone}A6 50%, transparent)`,
        }}
      />
    </div>
  );
}

const TIER_TONES: Record<Tier, string> = {
  gold: "var(--color-gold)",
  silver: "var(--color-silver)",
  bronze: "var(--color-bronze)",
};

/**
 * Tabla canónica de cortes de división. Si el ranking incluye al
 * jugador con `rank === key`, se renderiza el divisor de su valor
 * justo después de su fila. Centralizado para que el orden y el
 * mapeo sean la single source of truth.
 */
export const LEAGUE_DIVIDERS: Record<number, Tier> = {
  10: "gold",
  20: "silver",
  30: "bronze",
};
