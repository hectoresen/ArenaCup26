import type { BotStyle } from "./catalog";

/**
 * Generador de predicciones de bot — **pure function**. Toda la
 * aleatoriedad viene del callback `random()` inyectable, así los
 * tests son determinísticos con `seedrandom` y la distribución se
 * puede validar en N runs sin que dependa de `Math.random`.
 *
 * Distribuciones (ver `docs/bots.md`):
 *   - `simple` (~70% del catálogo): solo 1X2 uniforme {1/3, 1/3, 1/3}.
 *   - `mixed` (~20%): 80% simple + 20% exacto plausible (0-0..3-2).
 *   - `daredevil` (~10%): 30% simple + 70% exacto extremo (0-0..5-3).
 *
 * Los marcadores "plausibles" cubren el ~85% de resultados reales
 * en torneos profesionales. Los "extremos" añaden 4-3, 5-2, 5-3
 * con baja probabilidad — pico de puntos si aciertan, casi siempre
 * fallan.
 *
 * Output shape coincide con `PredictionInput` esperado por el
 * server action `submitPrediction` (ver `src/server/predictions/`).
 * Si la predicción es solo 1X2, `homeScore`/`awayScore` son `null`.
 * Si es exacta, ambos están seteados.
 */

export type BotPrediction =
  | {
      outcome: "home" | "draw" | "away";
      homeScore: null;
      awayScore: null;
    }
  | {
      outcome: "home" | "draw" | "away";
      homeScore: number;
      awayScore: number;
    };

/**
 * Marcadores plausibles: cubren la mayoría de resultados de un
 * torneo profesional. Distribución natural — 0-0 y 1-0 son los
 * más frecuentes en el Mundial real.
 */
const PLAUSIBLE_SCORES: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 0],
  [0, 2],
  [2, 1],
  [1, 2],
  [2, 2],
  [3, 1],
  [1, 3],
  [3, 0],
  [0, 3],
  [3, 2],
  [2, 3],
];

/**
 * Marcadores extremos: incluyen los plausibles + outliers (4-3,
 * 5-2, etc). Los daredevil "se la juegan" con resultados altos.
 */
const EXTREME_SCORES: ReadonlyArray<readonly [number, number]> = [
  ...PLAUSIBLE_SCORES,
  [4, 0],
  [0, 4],
  [4, 1],
  [1, 4],
  [4, 2],
  [2, 4],
  [4, 3],
  [3, 4],
  [5, 0],
  [0, 5],
  [5, 1],
  [1, 5],
  [5, 2],
  [2, 5],
  [5, 3],
  [3, 5],
];

/**
 * Probabilidades por style. La suma de cada fila debe ser 1.0.
 * Reading: `exactProb = P(esta predicción es exacta | style)`.
 */
const STYLE_EXACT_PROB: Record<BotStyle, number> = {
  simple: 0,
  mixed: 0.2,
  daredevil: 0.7,
};

function pickOutcome(random: () => number): "home" | "draw" | "away" {
  const r = random();
  if (r < 1 / 3) return "home";
  if (r < 2 / 3) return "draw";
  return "away";
}

function outcomeFromScore(home: number, away: number): "home" | "draw" | "away" {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function pickScore(
  random: () => number,
  pool: ReadonlyArray<readonly [number, number]>,
): readonly [number, number] {
  const idx = Math.floor(random() * pool.length);
  // `idx` puede ser `pool.length` si random() === 1.0 (ranuras), cap.
  const safeIdx = Math.min(idx, pool.length - 1);
  const pair = pool[safeIdx];
  // TS: index access puede ser undefined. El cap anterior garantiza válido.
  return pair ?? pool[0]!;
}

/**
 * Genera una predicción para el style del bot. Pure.
 *
 * @param style estilo del bot
 * @param random RNG inyectable (Math.random en runtime; seeded en tests)
 */
export function generatePrediction(
  style: BotStyle,
  random: () => number = Math.random,
): BotPrediction {
  const exactProb = STYLE_EXACT_PROB[style];
  const goExact = random() < exactProb;

  if (!goExact) {
    return {
      outcome: pickOutcome(random),
      homeScore: null,
      awayScore: null,
    };
  }

  // Exact prediction — pool depends on style.
  const pool = style === "daredevil" ? EXTREME_SCORES : PLAUSIBLE_SCORES;
  const [home, away] = pickScore(random, pool);
  return {
    outcome: outcomeFromScore(home, away),
    homeScore: home,
    awayScore: away,
  };
}
