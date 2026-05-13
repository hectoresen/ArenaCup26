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
