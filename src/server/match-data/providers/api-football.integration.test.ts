import { beforeAll, describe, expect, it } from "vitest";
import { createApiFootballProvider } from "./api-football";

/**
 * Tests de integración contra api-sports.io reales. Solo se ejecutan cuando
 * `API_FOOTBALL_KEY` está presente en el entorno (ej: `npm test` con
 * `.env` cargado o `API_FOOTBALL_KEY=… npm test`).
 *
 * Cada `it` consume 1 request del cupo diario del plan free (100/día).
 * Mantén este describe acotado.
 */
describe.skipIf(!process.env.API_FOOTBALL_KEY)(
  "ApiFootballProvider — real network (skipIf no API key)",
  () => {
    let provider: ReturnType<typeof createApiFootballProvider>;

    beforeAll(() => {
      provider = createApiFootballProvider({
        apiKey: process.env.API_FOOTBALL_KEY ?? "",
        baseUrl: process.env.API_FOOTBALL_BASE_URL,
      });
    });

    it("fetches Qatar 2022 fixtures (league=1, season=2022)", async () => {
      const fixtures = await provider.getFixtures({ leagueId: 1, season: 2022 });

      // El Mundial 2022 tuvo 64 partidos. La api debería devolver al menos
      // los 64 oficiales (a veces algún partido extra de calificación).
      expect(fixtures.length).toBeGreaterThanOrEqual(60);

      // La final ARG 3-3 FRA decidida por penaltis está siempre presente.
      const final = fixtures.find((f) => f.stage === "final");
      expect(final).toBeDefined();
      if (!final) return;

      const teamNames = [final.homeTeam.name, final.awayTeam.name].sort();
      expect(teamNames).toEqual(["Argentina", "France"]);
      expect(final.scoreAt90).toEqual({ home: 2, away: 2 });
      expect(final.scoreAtExtra).toEqual({ home: 3, away: 3 });
      expect(final.penaltyWinner).toBeDefined();
      expect(final.status).toBe("finished");
    }, 30_000);
  },
);
