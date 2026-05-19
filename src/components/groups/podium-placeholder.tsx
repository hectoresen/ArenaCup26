type Place = 1 | 2 | 3;

const TONE: Record<
  Place,
  { container: string; border: string; badge: string; label: string; copy: string; emoji: string }
> = {
  1: {
    container: "bg-gradient-to-br from-[#1e1a08]/40 to-[#14120a]/40",
    border: "border-dashed border-gold/40",
    badge: "border border-gold/40 bg-gold/10 text-gold",
    label: "1º",
    copy: "¿Te ves en la cima?",
    emoji: "👑",
  },
  2: {
    container: "bg-gradient-to-br from-[#141e2a]/40 to-[#0e1620]/40",
    border: "border-dashed border-silver/35",
    badge: "border border-silver/40 bg-silver/10 text-silver",
    label: "2º",
    copy: "La plata espera...",
    emoji: "🥈",
  },
  3: {
    container: "bg-gradient-to-br from-[#1a1008]/40 to-[#120e08]/40",
    border: "border-dashed border-bronze/35",
    badge: "border border-bronze/40 bg-bronze/10 text-bronze",
    label: "3º",
    copy: "¡Hay sitio aquí!",
    emoji: "🥉",
  },
};

/**
 * Placeholder visual cuando una posición del podio del grupo no tiene
 * ocupante. Mantiene el mismo footprint que `<PodiumCard>` para que
 * el grid quede alineado, pero usa border dashed + opacity reducida +
 * un copy juguetón.
 *
 * Animación sutil: el emoji "respira" con `blink` (definido en
 * `globals.css`) — opacity oscila entre 1 y 0.25 cada 2s, ciclo
 * infinito. Suficiente para llamar la atención sin distraer del
 * ranking real.
 *
 * `prefers-reduced-motion`: la regla global en `globals.css` ya
 * reduce todas las animations a 0.01ms para usuarios sensibles.
 */
export function PodiumPlaceholder({ place }: { place: Place }) {
  const tone = TONE[place];
  return (
    <div
      aria-label={`Posición ${place} libre — ${tone.copy}`}
      className={`relative block overflow-hidden rounded-2xl border-[2.5px] px-2.5 pb-3.5 pt-3.5 text-center ${tone.container} ${tone.border} opacity-90`}
    >
      <span
        className={`absolute end-2 top-2 rounded-full px-1.5 py-0.5 font-display text-[10px] leading-[1.4] ${tone.badge}`}
      >
        {tone.label}
      </span>
      <div
        className={`mx-auto mb-1.5 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-dashed border-white/15 bg-card-hover/40 text-2xl [animation:blink_2.4s_ease-in-out_infinite]`}
      >
        {tone.emoji}
      </div>
      <div className="mb-1 h-[20px]" aria-hidden="true" />
      <div className="mb-1.5 truncate text-[10px] font-extrabold leading-snug text-muted">
        {tone.copy}
      </div>
      <span className="block font-display text-base leading-none text-muted [animation:blink_2.4s_ease-in-out_infinite]">
        —
      </span>
      <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted/70">
        libre
      </div>
    </div>
  );
}
