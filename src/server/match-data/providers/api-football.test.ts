import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../types";
import { createApiFootballProvider } from "./api-football";

function makeFetcher(response: { status?: number; body: unknown }): typeof fetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const MIN_ENVELOPE = {
  get: "fixtures",
  parameters: { league: "1", season: "2022" },
  errors: [],
  results: 0,
  paging: { current: 1, total: 1 },
  response: [],
};

describe("createApiFootballProvider", () => {
  it("calls the right URL with the api key header", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://v3.football.api-sports.io/fixtures?league=1&season=2022");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-apisports-key")).toBe("test-key");
      return new Response(JSON.stringify(MIN_ENVELOPE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const provider = createApiFootballProvider({
      apiKey: "test-key",
      fetcher: fetcher as unknown as typeof fetch,
    });

    const result = await provider.getFixtures({ mode: "season", leagueId: 1, season: 2022 });
    expect(result).toEqual([]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("strips a trailing slash from baseUrl", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://example.test/fixtures?league=1&season=2022");
      return new Response(JSON.stringify(MIN_ENVELOPE), { status: 200 });
    });
    const provider = createApiFootballProvider({
      apiKey: "k",
      baseUrl: "https://example.test/",
      fetcher: fetcher as unknown as typeof fetch,
    });
    await provider.getFixtures({ mode: "season", leagueId: 1, season: 2022 });
  });

  it("translates plan limit errors to ProviderError 'plan_limited'", async () => {
    const fetcher = makeFetcher({
      body: {
        ...MIN_ENVELOPE,
        errors: { plan: "Free plans do not have access to this season, try from 2022 to 2024." },
      },
    });
    const provider = createApiFootballProvider({ apiKey: "k", fetcher });
    await expect(provider.getFixtures({ mode: "season", leagueId: 1, season: 2026 })).rejects.toMatchObject({
      name: "ProviderError",
      code: "plan_limited",
      source: "api-football",
    });
  });

  it("translates rate limits", async () => {
    const fetcher = makeFetcher({
      body: { ...MIN_ENVELOPE, errors: { rateLimit: "You reached the rate limit" } },
    });
    const provider = createApiFootballProvider({ apiKey: "k", fetcher });
    await expect(provider.getFixtures({ mode: "season", leagueId: 1, season: 2022 })).rejects.toMatchObject({
      code: "rate_limited",
    });
  });

  it("translates auth failures", async () => {
    const fetcher = makeFetcher({
      body: { ...MIN_ENVELOPE, errors: { token: "Missing or invalid API token" } },
    });
    const provider = createApiFootballProvider({ apiKey: "bad", fetcher });
    await expect(provider.getFixtures({ mode: "season", leagueId: 1, season: 2022 })).rejects.toMatchObject({
      code: "auth_failed",
    });
  });

  it("translates HTTP 401 to auth_failed", async () => {
    const fetcher = makeFetcher({ status: 401, body: {} });
    const provider = createApiFootballProvider({ apiKey: "bad", fetcher });
    await expect(provider.getFixtures({ mode: "season", leagueId: 1, season: 2022 })).rejects.toMatchObject({
      code: "auth_failed",
      httpStatus: 401,
    });
  });

  it("translates HTTP 429 to rate_limited", async () => {
    const fetcher = makeFetcher({ status: 429, body: {} });
    const provider = createApiFootballProvider({ apiKey: "k", fetcher });
    await expect(provider.getFixtures({ mode: "season", leagueId: 1, season: 2022 })).rejects.toMatchObject({
      code: "rate_limited",
    });
  });

  it("translates network errors", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const provider = createApiFootballProvider({ apiKey: "k", fetcher });
    await expect(provider.getFixtures({ mode: "season", leagueId: 1, season: 2022 })).rejects.toMatchObject({
      code: "network_error",
    });
  });

  it("parses a non-empty fixtures response", async () => {
    const fetcher = makeFetcher({
      body: {
        ...MIN_ENVELOPE,
        results: 1,
        response: [
          {
            fixture: {
              id: 999,
              date: "2022-12-18T15:00:00+00:00",
              timestamp: 1671375600,
              status: { long: "Match Finished", short: "FT", elapsed: 90 },
            },
            league: { id: 1, name: "World Cup", season: 2022, round: "Group A - 1" },
            teams: {
              home: { id: 1, name: "Test Home", logo: null, winner: true },
              away: { id: 2, name: "Test Away", logo: null, winner: false },
            },
            goals: { home: 2, away: 1 },
            score: {
              halftime: { home: 1, away: 0 },
              fulltime: { home: 2, away: 1 },
              extratime: { home: null, away: null },
              penalty: { home: null, away: null },
            },
          },
        ],
      },
    });

    const provider = createApiFootballProvider({ apiKey: "k", fetcher });
    const result = await provider.getFixtures({ mode: "season", leagueId: 1, season: 2022 });
    expect(result).toHaveLength(1);
    expect(result[0]?.externalId).toBe("999");
    expect(result[0]?.scoreAt90).toEqual({ home: 2, away: 1 });
    expect(result[0]?.stage).toBe("group");
  });

  it("ProviderError carries the source name", () => {
    const err = new ProviderError("test", "api-football", "unknown");
    expect(err.source).toBe("api-football");
    expect(err.code).toBe("unknown");
    expect(err.name).toBe("ProviderError");
  });
});
