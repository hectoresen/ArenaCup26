/**
 * Constantes del sistema de puntuación. Reflejan `docs/scoring.md` 1:1.
 * Cualquier cambio aquí requiere actualizar el doc y abrir una propuesta
 * `update-scoring-<motivo>`.
 */

export const POINTS = {
  /** Acertar el ganador o el empate, sin marcador exacto. */
  simple: 10,
  /** Acertar el marcador exacto. Sustituye al simple, no se suman. */
  exact: 30,
  /** Doble acertada (1X, X2 o 12). La mitad del simple. */
  double: 5,
} as const;

export const COMBO_MILESTONES = [3, 5, 10] as const;

export type ComboMilestone = (typeof COMBO_MILESTONES)[number];

/**
 * Bonus al alcanzar un hito de racha.
 * - `base`: la racha que alcanza el hito no contiene ninguna doble acertada.
 * - `modified`: la racha contiene al menos una doble acertada.
 */
export const COMBO_BONUS: {
  base: Record<ComboMilestone, number>;
  modified: Record<ComboMilestone, number>;
} = {
  base: { 3: 5, 5: 15, 10: 50 },
  modified: { 3: 3, 5: 5, 10: 9 },
};
