import type { MatchStage } from "@/server/scoring/types";

/**
 * Partidos del Mundial Qatar 2022 con resultados oficiales.
 *
 * v1: incluye los 16 partidos de eliminatoria (datos completos, incluyendo
 * prórrogas y penaltis donde aplique) + 8 partidos representativos de la
 * fase de grupos. Total: 24.
 *
 * Los 40 partidos de grupos restantes se completarán en una propuesta
 * `update-wc2022-group-completion` cuando se necesite cobertura total.
 *
 * Fuente: resultados oficiales FIFA Qatar 2022 (Nov 20 – Dec 18, 2022).
 */
export type WC2022MatchSeed = {
  /** Slug interno para tracking; no se almacena en BD. */
  slug: string;
  stage: MatchStage;
  homeCode: string;
  awayCode: string;
  /** ISO 8601 UTC. */
  kickoffAt: string;
  scoreAt90: { home: number; away: number };
  /** Solo en eliminatoria que llegó a prórroga. */
  scoreAtExtra: { home: number; away: number } | null;
  /** Solo cuando el partido fue a tanda de penaltis. */
  penaltyWinnerCode: string | null;
};

export const WC2022_MATCHES: WC2022MatchSeed[] = [
  // ─────────── Fase de grupos (8 representativos) ───────────
  {
    slug: "wc2022-grpA-qat-ecu",
    stage: "group",
    homeCode: "QAT",
    awayCode: "ECU",
    kickoffAt: "2022-11-20T16:00:00Z",
    scoreAt90: { home: 0, away: 2 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-grpB-eng-irn",
    stage: "group",
    homeCode: "ENG",
    awayCode: "IRN",
    kickoffAt: "2022-11-21T13:00:00Z",
    scoreAt90: { home: 6, away: 2 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-grpC-arg-ksa",
    stage: "group",
    homeCode: "ARG",
    awayCode: "KSA",
    kickoffAt: "2022-11-22T10:00:00Z",
    scoreAt90: { home: 1, away: 2 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-grpD-fra-aus",
    stage: "group",
    homeCode: "FRA",
    awayCode: "AUS",
    kickoffAt: "2022-11-22T19:00:00Z",
    scoreAt90: { home: 4, away: 1 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-grpE-ger-jpn",
    stage: "group",
    homeCode: "GER",
    awayCode: "JPN",
    kickoffAt: "2022-11-23T13:00:00Z",
    scoreAt90: { home: 1, away: 2 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-grpE-esp-crc",
    stage: "group",
    homeCode: "ESP",
    awayCode: "CRC",
    kickoffAt: "2022-11-23T16:00:00Z",
    scoreAt90: { home: 7, away: 0 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-grpG-bra-srb",
    stage: "group",
    homeCode: "BRA",
    awayCode: "SRB",
    kickoffAt: "2022-11-24T19:00:00Z",
    scoreAt90: { home: 2, away: 0 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-grpH-por-gha",
    stage: "group",
    homeCode: "POR",
    awayCode: "GHA",
    kickoffAt: "2022-11-24T16:00:00Z",
    scoreAt90: { home: 3, away: 2 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },

  // ─────────── Octavos de final (8) ───────────
  {
    slug: "wc2022-r16-ned-usa",
    stage: "round-of-16",
    homeCode: "NED",
    awayCode: "USA",
    kickoffAt: "2022-12-03T15:00:00Z",
    scoreAt90: { home: 3, away: 1 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-r16-arg-aus",
    stage: "round-of-16",
    homeCode: "ARG",
    awayCode: "AUS",
    kickoffAt: "2022-12-03T19:00:00Z",
    scoreAt90: { home: 2, away: 1 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-r16-fra-pol",
    stage: "round-of-16",
    homeCode: "FRA",
    awayCode: "POL",
    kickoffAt: "2022-12-04T15:00:00Z",
    scoreAt90: { home: 3, away: 1 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-r16-eng-sen",
    stage: "round-of-16",
    homeCode: "ENG",
    awayCode: "SEN",
    kickoffAt: "2022-12-04T19:00:00Z",
    scoreAt90: { home: 3, away: 0 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-r16-jpn-cro",
    stage: "round-of-16",
    homeCode: "JPN",
    awayCode: "CRO",
    kickoffAt: "2022-12-05T15:00:00Z",
    scoreAt90: { home: 1, away: 1 },
    scoreAtExtra: { home: 1, away: 1 },
    penaltyWinnerCode: "CRO",
  },
  {
    slug: "wc2022-r16-bra-kor",
    stage: "round-of-16",
    homeCode: "BRA",
    awayCode: "KOR",
    kickoffAt: "2022-12-05T19:00:00Z",
    scoreAt90: { home: 4, away: 1 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-r16-mar-esp",
    stage: "round-of-16",
    homeCode: "MAR",
    awayCode: "ESP",
    kickoffAt: "2022-12-06T15:00:00Z",
    scoreAt90: { home: 0, away: 0 },
    scoreAtExtra: { home: 0, away: 0 },
    penaltyWinnerCode: "MAR",
  },
  {
    slug: "wc2022-r16-por-che",
    stage: "round-of-16",
    homeCode: "POR",
    awayCode: "CHE",
    kickoffAt: "2022-12-06T19:00:00Z",
    scoreAt90: { home: 6, away: 1 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },

  // ─────────── Cuartos de final (4) ───────────
  {
    slug: "wc2022-qf-cro-bra",
    stage: "quarter",
    homeCode: "CRO",
    awayCode: "BRA",
    kickoffAt: "2022-12-09T15:00:00Z",
    scoreAt90: { home: 0, away: 0 },
    scoreAtExtra: { home: 1, away: 1 },
    penaltyWinnerCode: "CRO",
  },
  {
    slug: "wc2022-qf-ned-arg",
    stage: "quarter",
    homeCode: "NED",
    awayCode: "ARG",
    kickoffAt: "2022-12-09T19:00:00Z",
    scoreAt90: { home: 2, away: 2 },
    scoreAtExtra: { home: 2, away: 2 },
    penaltyWinnerCode: "ARG",
  },
  {
    slug: "wc2022-qf-mar-por",
    stage: "quarter",
    homeCode: "MAR",
    awayCode: "POR",
    kickoffAt: "2022-12-10T15:00:00Z",
    scoreAt90: { home: 1, away: 0 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-qf-eng-fra",
    stage: "quarter",
    homeCode: "ENG",
    awayCode: "FRA",
    kickoffAt: "2022-12-10T19:00:00Z",
    scoreAt90: { home: 1, away: 2 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },

  // ─────────── Semifinales (2) ───────────
  {
    slug: "wc2022-sf-arg-cro",
    stage: "semi",
    homeCode: "ARG",
    awayCode: "CRO",
    kickoffAt: "2022-12-13T19:00:00Z",
    scoreAt90: { home: 3, away: 0 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },
  {
    slug: "wc2022-sf-fra-mar",
    stage: "semi",
    homeCode: "FRA",
    awayCode: "MAR",
    kickoffAt: "2022-12-14T19:00:00Z",
    scoreAt90: { home: 2, away: 0 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },

  // ─────────── Tercer puesto (1) ───────────
  {
    slug: "wc2022-tp-cro-mar",
    stage: "third-place",
    homeCode: "CRO",
    awayCode: "MAR",
    kickoffAt: "2022-12-17T15:00:00Z",
    scoreAt90: { home: 2, away: 1 },
    scoreAtExtra: null,
    penaltyWinnerCode: null,
  },

  // ─────────── Final (1) — la épica ARG 3-3 FRA, ARG gana 4-2 en penaltis ───────────
  {
    slug: "wc2022-final-arg-fra",
    stage: "final",
    homeCode: "ARG",
    awayCode: "FRA",
    kickoffAt: "2022-12-18T15:00:00Z",
    scoreAt90: { home: 2, away: 2 },
    scoreAtExtra: { home: 3, away: 3 },
    penaltyWinnerCode: "ARG",
  },
];
