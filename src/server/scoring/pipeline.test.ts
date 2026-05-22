import { describe, expect, it } from "vitest";
import { matchRowToOutcome } from "./pipeline";

/**
 * `matchRowToOutcome` es la pieza pura del pipeline: convierte una
 * fila de la tabla `matches` (estado wire) al `MatchOutcome` que el
 * scoring engine sabe interpretar. Esta función es la frontera entre
 * "datos del provider" y "lógica de puntuación". Tiene que ser
 * inmune a defaults — si el provider envía null, la salida también
 * debe propagar null, sin "rellenar" 0-0.
 */
describe("matchRowToOutcome", () => {
  function baseRow(overrides: Record<string, unknown> = {}) {
    return {
      stage: "group",
      status: "finished",
      homeScore: null as number | null,
      awayScore: null as number | null,
      homeScoreExtra: null as number | null,
      awayScoreExtra: null as number | null,
      penaltyWinnerTeamId: null as string | null,
      homeTeamId: "team-home",
      awayTeamId: "team-away",
      ...overrides,
    };
  }

  it("returns scoreAt90=null cuando el marcador de 90' aún no está set", () => {
    expect(matchRowToOutcome(baseRow({ status: "live" })).scoreAt90).toBeNull();
  });

  it("combines homeScore + awayScore en scoreAt90 solo si AMBOS son números", () => {
    expect(matchRowToOutcome(baseRow({ homeScore: 2, awayScore: 1 })).scoreAt90).toEqual({
      home: 2,
      away: 1,
    });

    // Solo uno set → null (defensivo: el provider podría enviar
    // estado inconsistente y no queremos puntuar contra un marcador
    // a medias).
    expect(matchRowToOutcome(baseRow({ homeScore: 2 })).scoreAt90).toBeNull();
    expect(matchRowToOutcome(baseRow({ awayScore: 1 })).scoreAt90).toBeNull();
  });

  it("propaga scoreAtExtra solo cuando hubo prórroga real (ambos campos set)", () => {
    expect(
      matchRowToOutcome(baseRow({ homeScoreExtra: 3, awayScoreExtra: 2 })).scoreAtExtra,
    ).toEqual({ home: 3, away: 2 });
    expect(matchRowToOutcome(baseRow({ homeScoreExtra: 3 })).scoreAtExtra).toBeNull();
  });

  it("traduce penaltyWinnerTeamId al lado correcto del partido", () => {
    // Local ganó penales.
    expect(matchRowToOutcome(baseRow({ penaltyWinnerTeamId: "team-home" })).penaltyWinner).toBe(
      "home",
    );

    // Visitante ganó.
    expect(matchRowToOutcome(baseRow({ penaltyWinnerTeamId: "team-away" })).penaltyWinner).toBe(
      "away",
    );

    // Sin penales.
    expect(matchRowToOutcome(baseRow()).penaltyWinner).toBeNull();

    // Defensivo: si el id no coincide con ninguno de los dos teams
    // (estado corrupto), devolvemos null en lugar de inventar lado.
    expect(
      matchRowToOutcome(baseRow({ penaltyWinnerTeamId: "team-other" })).penaltyWinner,
    ).toBeNull();
  });

  it("preserva el stage y status sin transformación", () => {
    const result = matchRowToOutcome(baseRow({ stage: "final", status: "finished" }));
    expect(result.stage).toBe("final");
    expect(result.status).toBe("finished");
  });

  it("acepta un partido `voided` o `cancelled` sin reventar (status crudo)", () => {
    // El engine después decide qué hacer con statuses no-finished;
    // este helper solo traduce.
    expect(matchRowToOutcome(baseRow({ status: "cancelled" })).status).toBe("cancelled");
    expect(matchRowToOutcome(baseRow({ status: "postponed" })).status).toBe("postponed");
  });
});
