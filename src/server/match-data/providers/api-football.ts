import {
  type GetFixturesOptions,
  type MatchDataProvider,
  type ProviderErrorCode,
  ProviderError,
  type ProviderMatch,
} from "../types";
import { type ApiFootballFixture, parseApiFootballFixture } from "./api-football.parser";

const PROVIDER_NAME = "api-football";

type ApiFootballEnvelope<T> = {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | unknown[];
  results: number;
  paging: { current: number; total: number };
  response: T;
};

export type ApiFootballConfig = {
  apiKey: string;
  baseUrl?: string;
  /** Para tests: permite inyectar un fetch alternativo. */
  fetcher?: typeof fetch;
};

export function createApiFootballProvider(config: ApiFootballConfig): MatchDataProvider {
  const baseUrl = (config.baseUrl ?? "https://v3.football.api-sports.io").replace(/\/$/, "");
  const fetcher = config.fetcher ?? fetch;

  async function callApi<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    );
    const url = `${baseUrl}${path}?${query}`;

    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { "x-apisports-key": config.apiKey },
      });
    } catch (error) {
      throw new ProviderError(
        `Network error calling api-football: ${error instanceof Error ? error.message : String(error)}`,
        PROVIDER_NAME,
        "network_error",
        undefined,
        error,
      );
    }

    if (!response.ok) {
      throw new ProviderError(
        `api-football HTTP ${response.status}`,
        PROVIDER_NAME,
        codeFromHttpStatus(response.status),
        response.status,
      );
    }

    let body: ApiFootballEnvelope<T>;
    try {
      body = (await response.json()) as ApiFootballEnvelope<T>;
    } catch (error) {
      throw new ProviderError(
        "api-football returned invalid JSON",
        PROVIDER_NAME,
        "parse_error",
        response.status,
        error,
      );
    }

    const errors = body.errors;
    const hasErrors = Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0;
    if (hasErrors) {
      const code = inferErrorCode(errors);
      throw new ProviderError(
        `api-football error: ${JSON.stringify(errors)}`,
        PROVIDER_NAME,
        code,
        response.status,
        errors,
      );
    }

    return body.response;
  }

  return {
    name: PROVIDER_NAME,

    async getFixtures(opts: GetFixturesOptions): Promise<ProviderMatch[]> {
      const raw = await callApi<ApiFootballFixture[]>("/fixtures", {
        league: opts.leagueId,
        season: opts.season,
      });
      const fetchedAt = new Date();
      return raw.map((f) => parseApiFootballFixture(f, fetchedAt));
    },
  };
}

function codeFromHttpStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "bad_request";
  return "unknown";
}

function inferErrorCode(errors: Record<string, string> | unknown[]): ProviderErrorCode {
  if (Array.isArray(errors)) return "unknown";
  const flat = Object.values(errors).join(" ").toLowerCase();
  if (flat.includes("plan")) return "plan_limited";
  if (flat.includes("rate") || flat.includes("limit")) return "rate_limited";
  if (flat.includes("token") || flat.includes("authentication") || flat.includes("auth")) {
    return "auth_failed";
  }
  return "unknown";
}
