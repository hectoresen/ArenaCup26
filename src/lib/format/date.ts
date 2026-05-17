/**
 * Devuelve la etiqueta corta para una fecha de partido en el panel:
 * "Hoy" / "Mañana" / "DD mmm" (e.g. "09 jul"). Independiente del ICU
 * del runtime — los meses están traducidos manualmente por locale.
 *
 * Pure function. La comparación de día se hace en la zona horaria
 * UTC para que el output sea reproducible entre servidor y cliente
 * (sin riesgo de hidratación dispar).
 *
 * Si el partido cae fuera del rango [hoy, hoy+1día], se devuelve el
 * formato "DD mmm" en el locale dado.
 */
export type SupportedLocale = "es" | "en" | "fr" | "ar";

type DateLabels = {
  today: string;
  tomorrow: string;
  months: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
};

const LABELS: Record<SupportedLocale, DateLabels> = {
  es: {
    today: "Hoy",
    tomorrow: "Mañana",
    months: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  },
  en: {
    today: "Today",
    tomorrow: "Tomorrow",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  fr: {
    today: "Aujourd'hui",
    tomorrow: "Demain",
    months: [
      "janv",
      "févr",
      "mars",
      "avr",
      "mai",
      "juin",
      "juil",
      "août",
      "sept",
      "oct",
      "nov",
      "déc",
    ],
  },
  ar: {
    today: "اليوم",
    tomorrow: "غدًا",
    months: [
      "يناير",
      "فبراير",
      "مارس",
      "أبريل",
      "مايو",
      "يونيو",
      "يوليو",
      "أغسطس",
      "سبتمبر",
      "أكتوبر",
      "نوفمبر",
      "ديسمبر",
    ],
  },
};

/**
 * Comparación de "día calendario" en UTC. Dos fechas son el mismo
 * día si comparten año, mes y día UTC. (Para ArenaCup26 los
 * kickoffs y "now()" siempre vienen en UTC del servidor.)
 */
export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function formatMatchDate(
  date: Date,
  locale: SupportedLocale,
  now: Date = new Date(),
): string {
  const labels = LABELS[locale];
  if (isSameUtcDay(date, now)) return labels.today;

  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (isSameUtcDay(date, tomorrow)) return labels.tomorrow;

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = labels.months[date.getUTCMonth()] ?? "?";
  return `${day} ${month}`;
}

/**
 * Hora "HH:mm" en UTC (sin zona horaria). El renderer del cliente puede
 * convertir a local si necesita, pero por defecto mostramos la hora
 * canónica del torneo (cuyas kickoffs llegan en UTC del proveedor).
 */
export function formatMatchTime(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
