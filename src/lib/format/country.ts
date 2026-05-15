/**
 * Convierte un código de país ISO 3166-1 alpha-2 (e.g. "MX", "AR")
 * en el emoji de bandera correspondiente (regional indicator pairs).
 *
 * Devuelve `null` si:
 * - el código es null/undefined/vacío
 * - no tiene exactamente 2 letras (los códigos FIFA de 3 como "ARG"
 *   no son convertibles)
 * - alguna letra está fuera del rango A-Z
 *
 * Pure function — sin dependencias de Intl ni runtime ICU.
 */
export function countryCodeToFlag(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length !== 2) return null;
  const A = "A".charCodeAt(0);
  const Z = "Z".charCodeAt(0);
  const c1 = trimmed.charCodeAt(0);
  const c2 = trimmed.charCodeAt(1);
  if (c1 < A || c1 > Z || c2 < A || c2 > Z) return null;
  const REGIONAL_A = 0x1f1e6;
  return String.fromCodePoint(REGIONAL_A + (c1 - A), REGIONAL_A + (c2 - A));
}

/**
 * Inverso de `countryCodeToFlag`: dado un emoji de bandera ISO
 * (formado por dos Regional Indicator Symbols, ej. "🇪🇸"), devuelve
 * el código alpha-2 ("ES"). Devuelve `null` si el string no es un
 * emoji de bandera reconocible.
 *
 * Útil para componentes que reciben `flag: string | null` (legacy
 * shape de WC2022 seed) y necesitan saber qué bandera real
 * dibujar: si extraemos el code, podemos usar `<CountryFlag>` con
 * PNG real en lugar de renderizar el emoji texto (que en Windows
 * no se ve).
 */
export function flagEmojiToCountryCode(flag: string | null | undefined): string | null {
  if (!flag) return null;
  // Un emoji de bandera ISO ocupa 4 code units (2 chars UTF-16
  // para cada uno de los 2 Regional Indicator).
  if (flag.length !== 4) return null;
  const cp1 = flag.codePointAt(0);
  const cp2 = flag.codePointAt(2);
  if (cp1 === undefined || cp2 === undefined) return null;
  const REGIONAL_A = 0x1f1e6;
  const REGIONAL_Z = 0x1f1ff;
  if (cp1 < REGIONAL_A || cp1 > REGIONAL_Z) return null;
  if (cp2 < REGIONAL_A || cp2 > REGIONAL_Z) return null;
  const A = "A".charCodeAt(0);
  return String.fromCharCode(A + (cp1 - REGIONAL_A), A + (cp2 - REGIONAL_A));
}
