"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Fecha en UTC (la que viene del SSR). */
  date: Date | string;
};

/**
 * Renderiza "HH:mm" en la zona horaria del navegador.
 *
 * Estrategia:
 *  - **SSR**: render "HH:mm UTC" para que el HTML inicial sea
 *    determinista entre server y cliente (sin hydration mismatch) y
 *    el sufijo `UTC` deja claro qué hora se está mostrando si JS
 *    está deshabilitado.
 *  - **Tras hidratar**: el `useEffect` calcula la hora local con
 *    `Intl.DateTimeFormat` y reemplaza el contenido.
 *
 * Esto resuelve el problema de un user en `Europe/Madrid` que ve
 * "22:30" (UTC) en una card y piensa que es hora local: realmente
 * son las 00:30 del día siguiente en su zona.
 */
export function LocalTime({ date }: Props) {
  const d = typeof date === "string" ? new Date(date) : date;
  const utcLabel = `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")} UTC`;

  const [label, setLabel] = useState(utcLabel);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    setLabel(formatter.format(d));
  }, [d]);

  return (
    <span suppressHydrationWarning aria-label={`Kickoff: ${utcLabel}`}>
      {label}
    </span>
  );
}
