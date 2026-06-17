/**
 * Sistema de divisiones del ranking — single source of truth.
 *
 * Documentación completa: `docs/divisions.md`.
 *
 * Tres divisiones cosméticas con umbrales fijos:
 *  - Oro:    rank 1-10
 *  - Plata:  rank 11-20
 *  - Bronce: rank 21-30
 *
 * Las divisiones se derivan en tiempo real del rank actual del user;
 * NO se persisten en BD. Esto las hace inherentemente reversibles:
 * si caes de #10 a #11, pierdes el oro y heredas la plata en el
 * siguiente render del perfil. Los logros `division-*` SÍ son
 * irreversibles (una vez desbloqueado, un logro no se pierde) — la
 * medalla del perfil refleja el estado actual, los logros reflejan
 * la cima histórica.
 */

export type Division = "gold" | "silver" | "bronze";

/**
 * Devuelve la división actual del user dado su rank global, o `null`
 * si está fuera del top 30 (sin medalla) o si no tiene rank.
 *
 * Edge cases conscientes:
 *  - `rank === 0` o negativo → null (input inválido; defensa).
 *  - `rank > 30` → null (sin medalla).
 *  - `rank === null | undefined` → null (user sin posición todavía).
 */
export function getDivisionForRank(rank: number | null | undefined): Division | null {
  if (rank === null || rank === undefined) return null;
  if (rank <= 0) return null;
  if (rank <= 10) return "gold";
  if (rank <= 20) return "silver";
  if (rank <= 30) return "bronze";
  return null;
}

/**
 * Umbral máximo (inclusive) de cada división. Útil para tests, copys
 * dinámicos en la UI ("entra al top 10 para conseguir el oro") y
 * eventuales hot-fixes sin tocar `getDivisionForRank`.
 */
export const DIVISION_MAX_RANK: Record<Division, number> = {
  gold: 10,
  silver: 20,
  bronze: 30,
};
