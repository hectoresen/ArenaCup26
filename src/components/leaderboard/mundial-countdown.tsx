"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Kickoff oficial del primer partido del Mundial 2026: Mexico vs
 * Morocco, 11 jun 2026 19:00 UTC. Cuando este timestamp se cruce, el
 * componente deja de renderizar (no aporta nada un countdown a algo
 * que ya empezó).
 *
 * Fuente: api-football `league=1, season=2026` Group Stage - 1.
 * Si FIFA cambia el calendario antes del torneo, ajustar aquí.
 */
const MUNDIAL_KICKOFF_UTC = new Date("2026-06-11T19:00:00Z");

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function computeTimeLeft(now: number): TimeLeft | null {
  const diff = MUNDIAL_KICKOFF_UTC.getTime() - now;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

/**
 * Cuenta atrás al kickoff del Mundial 2026. Solo se renderiza si
 * faltan segundos para el primer pitido. Tras el inicio del torneo
 * el componente devuelve `null` automáticamente.
 *
 * Diseño: 4 píldoras (días/horas/min/seg) en horizontal, header
 * "EMPIEZA EN" y footer con la sede + fecha. Estilos coherentes con
 * el resto de la landing (gold, font-display, border-card).
 *
 * Hidratación: durante SSR mostramos un placeholder genérico para
 * evitar mismatch (la diferencia de ms entre server y cliente
 * cambia los seconds visibles). Al hidratar arrancamos el tick.
 */
export function MundialCountdown() {
  const t = useTranslations("countdown");
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(computeTimeLeft(Date.now()));
    const id = setInterval(() => {
      setTimeLeft(computeTimeLeft(Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Tras el kickoff, dejamos de mostrar el componente. Si el cliente
  // recarga después del 11 jun 2026 19:00 UTC, no aparece nada.
  if (mounted && timeLeft === null) return null;

  return (
    <section
      aria-label={t("ariaLabel")}
      className="mb-6 opacity-0 [animation:popIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
    >
      <div className="rounded-3xl border-2 border-gold/35 bg-gradient-to-b from-gold/[0.05] to-card px-5 py-5 text-center shadow-[0_0_32px_rgba(245,200,66,0.12)]">
        <div className="mb-3.5 font-display text-[11px] uppercase tracking-[0.22em] text-gold/90">
          {t("title")}
        </div>
        <div className="flex items-stretch justify-center gap-2 sm:gap-3">
          <Slot value={timeLeft?.days ?? null} label={t("days")} pad={2} />
          <Separator />
          <Slot value={timeLeft?.hours ?? null} label={t("hours")} />
          <Separator />
          <Slot value={timeLeft?.minutes ?? null} label={t("minutes")} />
          <Separator />
          <Slot value={timeLeft?.seconds ?? null} label={t("seconds")} />
        </div>
        <div className="mt-3.5 font-display text-[10px] uppercase tracking-[0.18em] text-muted">
          {t("kickoffLabel")}
        </div>
      </div>
    </section>
  );
}

function Slot({ value, label, pad = 2 }: { value: number | null; label: string; pad?: number }) {
  // Durante SSR (value=null) renderizamos guiones para evitar el
  // hydration mismatch y dar feedback visual mínimo. Al hidratar, el
  // useEffect rellena con el número real en <1s.
  const display = value === null ? "—".repeat(pad) : String(value).padStart(pad, "0");
  return (
    <div className="flex min-w-[52px] flex-col items-center gap-1 rounded-2xl border-[1.5px] border-gold/25 bg-card-hover px-2.5 py-2 sm:min-w-[60px]">
      <span
        className="font-display text-[26px] leading-none tracking-[-1px] text-gold sm:text-[30px]"
        suppressHydrationWarning
      >
        {display}
      </span>
      <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <span
      aria-hidden="true"
      className="self-center font-display text-xl leading-none text-gold/40 sm:text-2xl"
    >
      :
    </span>
  );
}
