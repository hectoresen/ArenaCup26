/**
 * Formatea un entero con separador de miles "." al estilo es-ES.
 *
 * No usa `toLocaleString` porque las builds de Node con `small-icu`
 * (default en muchas distros) caen a en-US y devuelven "4820" en vez
 * de "4.820". Este helper es determinista entre runtimes.
 */
export function formatPointsEs(n: number): string {
  const neg = n < 0;
  const digits = Math.trunc(Math.abs(n)).toString();
  const withSeparators = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return neg ? `-${withSeparators}` : withSeparators;
}
