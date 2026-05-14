import type { MatchOutcome, Prediction, ScoreResult, StreakState } from "./types";

/**
 * Un fixture es un escenario nominal del producto descrito en datos:
 * el partido, la predicción del usuario, su racha previa y el resultado
 * esperado del scoring engine.
 *
 * Sirven dos propósitos:
 * - Test runner determinista que pasa cada fixture por el engine y
 *   verifica el `expected`.
 * - Documentación legible para no-devs (product, QA) sobre cómo se
 *   comportan las reglas en casos concretos.
 */
export type ScoringFixture = {
  id: string;
  description: string;
  match: MatchOutcome;
  prediction: Prediction;
  streakBefore: StreakState;
  expected: ScoreResult;
};

const NO_STREAK: StreakState = { current: 0, containsDouble: false };

export const EDGE_CASE_FIXTURES: ScoringFixture[] = [
  // ──────────────── GRUPOS ────────────────────────────────────
  {
    id: "01-grupo-empate-acertado",
    description: "Partido de grupos termina 1-1, predicción simple 'draw' acertada.",
    match: {
      status: "finished",
      stage: "group",
      scoreAt90: { home: 1, away: 1 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "simple",
      predictedWinner: "draw",
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: NO_STREAK,
    expected: {
      points: 10,
      kind: "simple",
      streakAfter: { current: 1, containsDouble: false },
      comboBonuses: [],
    },
  },
  {
    id: "02-grupo-goleada-exacto",
    description: "Goleada 5-0 con predicción exacta 5-0.",
    match: {
      status: "finished",
      stage: "group",
      scoreAt90: { home: 5, away: 0 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "exact",
      predictedWinner: null,
      predictedHomeScore: 5,
      predictedAwayScore: 0,
    },
    streakBefore: NO_STREAK,
    expected: {
      points: 30,
      kind: "exact",
      streakAfter: { current: 1, containsDouble: false },
      comboBonuses: [],
    },
  },
  {
    id: "03-grupo-doble-1x-acierta",
    description: "Empate 0-0 en grupos con predicción doble 1X (cubre home o empate).",
    match: {
      status: "finished",
      stage: "group",
      scoreAt90: { home: 0, away: 0 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "double-1x",
      predictedWinner: null,
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: NO_STREAK,
    expected: {
      points: 5,
      kind: "double",
      streakAfter: { current: 1, containsDouble: true },
      comboBonuses: [],
    },
  },
  {
    id: "04-exacto-falla-mismo-ganador",
    description:
      "Predicción exacta 2-1 contra resultado real 3-0: miss (no hay fallback a simple aunque el ganador sea correcto).",
    match: {
      status: "finished",
      stage: "group",
      scoreAt90: { home: 3, away: 0 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "exact",
      predictedWinner: null,
      predictedHomeScore: 2,
      predictedAwayScore: 1,
    },
    streakBefore: NO_STREAK,
    expected: {
      points: 0,
      kind: "miss",
      streakAfter: { current: 0, containsDouble: false },
      comboBonuses: [],
    },
  },

  // ──────────────── ELIMINATORIA ──────────────────────────────
  {
    id: "05-eliminatoria-prorroga-simple",
    description:
      "Eliminatoria 1-1 al 90', 2-1 en prórroga; predicción simple 'home' acierta usando el marcador de prórroga.",
    match: {
      status: "finished",
      stage: "round-of-16",
      scoreAt90: { home: 1, away: 1 },
      scoreAtExtra: { home: 2, away: 1 },
      penaltyWinner: null,
    },
    prediction: {
      kind: "simple",
      predictedWinner: "home",
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: NO_STREAK,
    expected: {
      points: 10,
      kind: "simple",
      streakAfter: { current: 1, containsDouble: false },
      comboBonuses: [],
    },
  },
  {
    id: "06-eliminatoria-penaltis-simple-home",
    description:
      "Eliminatoria 1-1@120', penaltis ganados por home; predicción simple 'home' acierta.",
    match: {
      status: "finished",
      stage: "quarter",
      scoreAt90: { home: 1, away: 1 },
      scoreAtExtra: { home: 1, away: 1 },
      penaltyWinner: "home",
    },
    prediction: {
      kind: "simple",
      predictedWinner: "home",
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: NO_STREAK,
    expected: {
      points: 10,
      kind: "simple",
      streakAfter: { current: 1, containsDouble: false },
      comboBonuses: [],
    },
  },
  {
    id: "07-eliminatoria-penaltis-exacto",
    description:
      "Eliminatoria 1-1@120', penaltis ganados por home; predicción exacta 1-1 acierta (penaltis no suman al marcador).",
    match: {
      status: "finished",
      stage: "semi",
      scoreAt90: { home: 1, away: 1 },
      scoreAtExtra: { home: 1, away: 1 },
      penaltyWinner: "home",
    },
    prediction: {
      kind: "exact",
      predictedWinner: null,
      predictedHomeScore: 1,
      predictedAwayScore: 1,
    },
    streakBefore: NO_STREAK,
    expected: {
      points: 30,
      kind: "exact",
      streakAfter: { current: 1, containsDouble: false },
      comboBonuses: [],
    },
  },
  {
    id: "08-eliminatoria-empate-prediction-simple-falla",
    description:
      "Eliminatoria 1-1@120' decidida por penaltis: predecir 'draw' siempre falla en eliminatoria.",
    match: {
      status: "finished",
      stage: "final",
      scoreAt90: { home: 1, away: 1 },
      scoreAtExtra: { home: 1, away: 1 },
      penaltyWinner: "home",
    },
    prediction: {
      kind: "simple",
      predictedWinner: "draw",
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: { current: 4, containsDouble: false },
    expected: {
      points: 0,
      kind: "miss",
      streakAfter: { current: 0, containsDouble: false },
      comboBonuses: [],
    },
  },
  {
    id: "09-eliminatoria-doble-12-siempre-acierta",
    description:
      "En eliminatoria, doble 12 cubre cualquier ganador (home o away). Aquí gana home outright.",
    match: {
      status: "finished",
      stage: "round-of-16",
      scoreAt90: { home: 3, away: 0 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "double-12",
      predictedWinner: null,
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: NO_STREAK,
    expected: {
      points: 5,
      kind: "double",
      streakAfter: { current: 1, containsDouble: true },
      comboBonuses: [],
    },
  },

  // ──────────────── ESTADOS ANULADOS ──────────────────────────
  {
    id: "10-cancelado-racha-preservada",
    description:
      "Partido cancelado: la predicción se anula y la racha de 5 se conserva (no se rompe ni avanza).",
    match: {
      status: "cancelled",
      stage: "group",
      scoreAt90: null,
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "simple",
      predictedWinner: "home",
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: { current: 5, containsDouble: false },
    expected: {
      points: 0,
      kind: "voided",
      streakAfter: { current: 5, containsDouble: false },
      comboBonuses: [],
    },
  },
  {
    id: "11-pospuesto-racha-con-doble-preservada",
    description:
      "Partido pospuesto: racha con doble previa se conserva intacta, incluyendo containsDouble=true.",
    match: {
      status: "postponed",
      stage: "group",
      scoreAt90: null,
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "double-1x",
      predictedWinner: null,
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: { current: 3, containsDouble: true },
    expected: {
      points: 0,
      kind: "voided",
      streakAfter: { current: 3, containsDouble: true },
      comboBonuses: [],
    },
  },

  // ──────────────── COMBOS / RACHA ────────────────────────────
  {
    id: "12-combo-hito-3-base",
    description:
      "Racha de 2 (sin dobles) + simple acertado → cruza hito 3 con bonus base +5. Total 15.",
    match: {
      status: "finished",
      stage: "group",
      scoreAt90: { home: 2, away: 1 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "simple",
      predictedWinner: "home",
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: { current: 2, containsDouble: false },
    expected: {
      points: 15,
      kind: "simple",
      streakAfter: { current: 3, containsDouble: false },
      comboBonuses: [{ milestone: 3, points: 5 }],
    },
  },
  {
    id: "13-combo-hito-3-modificado-por-doble-en-curso",
    description:
      "Racha {2, true}: la racha ya contenía una doble. Un simple cruza hito 3 con bonus modificado +3. Total 13.",
    match: {
      status: "finished",
      stage: "group",
      scoreAt90: { home: 2, away: 1 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "simple",
      predictedWinner: "home",
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: { current: 2, containsDouble: true },
    expected: {
      points: 13,
      kind: "simple",
      streakAfter: { current: 3, containsDouble: true },
      comboBonuses: [{ milestone: 3, points: 3 }],
    },
  },
  {
    id: "14-combo-hito-3-cruzado-por-doble",
    description:
      "Racha {2, false}: una doble acertada cruza el hito 3. La doble entra en la racha → containsDouble=true → bonus modificado +3. Total 5+3=8.",
    match: {
      status: "finished",
      stage: "group",
      scoreAt90: { home: 2, away: 0 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "double-1x",
      predictedWinner: null,
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: { current: 2, containsDouble: false },
    expected: {
      points: 8,
      kind: "double",
      streakAfter: { current: 3, containsDouble: true },
      comboBonuses: [{ milestone: 3, points: 3 }],
    },
  },
  {
    id: "15-combo-hito-10-base-con-exacto",
    description: "Racha 9 limpia + exacto → cruza hito 10 con +50, total 30+50=80.",
    match: {
      status: "finished",
      stage: "group",
      scoreAt90: { home: 2, away: 1 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "exact",
      predictedWinner: null,
      predictedHomeScore: 2,
      predictedAwayScore: 1,
    },
    streakBefore: { current: 9, containsDouble: false },
    expected: {
      points: 80,
      kind: "exact",
      streakAfter: { current: 10, containsDouble: false },
      comboBonuses: [{ milestone: 10, points: 50 }],
    },
  },
  {
    id: "16-combo-hito-5-modificado",
    description:
      "Racha {4, true} (con doble previa) + simple acierta → hito 5 modificado +5. Total 15.",
    match: {
      status: "finished",
      stage: "group",
      scoreAt90: { home: 0, away: 1 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "simple",
      predictedWinner: "away",
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: { current: 4, containsDouble: true },
    expected: {
      points: 15,
      kind: "simple",
      streakAfter: { current: 5, containsDouble: true },
      comboBonuses: [{ milestone: 5, points: 5 }],
    },
  },
  {
    id: "17-miss-resetea-racha-larga",
    description:
      "Racha de 7 con doble previa: un miss en eliminatoria (predicción 'draw' siempre falla) resetea racha completa.",
    match: {
      status: "finished",
      stage: "semi",
      scoreAt90: { home: 2, away: 0 },
      scoreAtExtra: null,
      penaltyWinner: null,
    },
    prediction: {
      kind: "simple",
      predictedWinner: "draw",
      predictedHomeScore: null,
      predictedAwayScore: null,
    },
    streakBefore: { current: 7, containsDouble: true },
    expected: {
      points: 0,
      kind: "miss",
      streakAfter: { current: 0, containsDouble: false },
      comboBonuses: [],
    },
  },
];
