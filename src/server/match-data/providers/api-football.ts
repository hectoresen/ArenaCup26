import {
  type GetFixturesOptions,
  type MatchDataProvider,
  ProviderError,
  type ProviderErrorCode,
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
      const fetchedAt = new Date();

      if (opts.mode === "season") {
        const raw = await callApi<ApiFootballFixture[]>("/fixtures", {
          league: opts.leagueId,
          season: opts.season,
        });
        return raw.map((f) => parseApiFootballFixture(f, fetchedAt));
      }

      // date-window mode: 1 request por día. api-football no admite
      // rango ?from/?to en el plan free, así que iteramos.
      //
      // Resiliencia por día: el plan free **también** restringe `?date=`
      // a una ventana estrecha alrededor de hoy ("try from YYYY-MM-DD
      // to YYYY-MM-DD"). Si un día concreto cae fuera, lo skippeamos
      // con un log y seguimos con el resto en vez de abortar todo el
      // sync. Errores no-plan (auth_failed, network_error) sí abortan
      // porque indican problema global.
      const days = enumerateDates(opts.from, opts.to);
      const allFixtures: ApiFootballFixture[] = [];
      for (const day of days) {
        try {
          const raw = await callApi<ApiFootballFixture[]>("/fixtures", {
            date: day,
          });
          allFixtures.push(...raw);
        } catch (err) {
          if (err instanceof ProviderError && err.code === "plan_limited") {
            // Día fuera del rango del free tier: log y continúa.
            // eslint-disable-next-line no-console
            console.log(
              `[AC/provider] plan_limited for date=${day}, skipping (free tier covers a narrow window)`,
            );
            continue;
          }
          throw err;
        }
      }
      const leagueFilter =
        opts.leagueIds && opts.leagueIds.length > 0 ? new Set(opts.leagueIds) : null;
      const filtered = leagueFilter
        ? allFixtures.filter((f) => leagueFilter.has(f.league.id))
        : allFixtures;
      return filtered.map((f) => parseApiFootballFixture(f, fetchedAt));
    },
  };
}

/**
 * Lista los días entre `from` y `to` (ambos inclusive) en formato
 * `YYYY-MM-DD` UTC. Si `from > to` devuelve vacío.
 */
function enumerateDates(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
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
