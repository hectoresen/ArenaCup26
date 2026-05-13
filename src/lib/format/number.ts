export type PointsLocale = "es" | "en" | "fr" | "ar";

const SEPARATOR: Record<PointsLocale, string> = {
  es: ".",
  en: ",",
  // Francés usa NBSP como separador de miles (4 820), pero en este
  // contexto el carácter no se distingue visualmente del espacio
  // normal en el font de UI. Usamos espacio normal para evitar
  // problemas con cualquier paso intermedio (logs, copy-paste).
  fr: " ",
  // Árabe: el separador de miles en la convención formal es la coma
  // arábiga (٬). Mantenemos coma latina porque es lo más legible al
  // mezclar con dígitos latinos del resto del UI.
  ar: ",",
};

/**
 * Formatea un entero con separador de miles según el locale dado.
 *
 * No usa `toLocaleString` porque las builds de Node con `small-icu`
 * (default en muchas distros) caen a en-US y devuelven "4820" en vez
 * de "4.820" para `es-ES`. Este helper es determinista entre
 * runtimes.
 */
export function formatPoints(n: number, locale: PointsLocale): string {
  const neg = n < 0;
  const digits = Math.trunc(Math.abs(n)).toString();
  const separator = SEPARATOR[locale];
  const withSeparators = digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return neg ? `-${withSeparators}` : withSeparators;
}

/**
 * Alias retrocompatible. Equivale a `formatPoints(n, "es")` —
 * mantenido para los componentes que ya lo usaban
 * (rank-row, podium-card).
 */
export function formatPointsEs(n: number): string {
  return formatPoints(n, "es");
}
