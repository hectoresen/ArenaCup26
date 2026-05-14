import { eq, sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { teamExternalIds, teams } from "@/server/db/schema";

type ApiFootballTeamsResponse = {
  response: Array<{
    team: {
      id: number;
      name: string;
      code: string | null;
      country: string | null;
    };
  }>;
  /**
   * En las respuestas 200 OK, api-football devuelve detalles del
   * error en este envelope:
   *   - object (`{ plan: "...", token: "...", rate: "..." }`) cuando
   *     hay errores
   *   - array vacío `[]` cuando todo va bien
   */
  errors: Record<string, string> | unknown[];
  results: number;
};

const COUNTRY_FLAGS: Record<string, string> = {
  Spain: "🇪🇸",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Italy: "🇮🇹",
  Portugal: "🇵🇹",
  Netherlands: "🇳🇱",
  Belgium: "🇧🇪",
  Argentina: "🇦🇷",
  Brazil: "🇧🇷",
  Mexico: "🇲🇽",
  USA: "🇺🇸",
};

function generateCodeFromName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-zA-Z]+/g, " ")
    .trim()
    .toUpperCase();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1].slice(0, 2)}`.padEnd(3, "X").slice(0, 3);
  }
  return cleaned.replace(/\s+/g, "").slice(0, 3).padEnd(3, "X");
}

export type EnsureTeamsSeededResult =
  | { skipped: true; reason: "already_seeded" }
  | { skipped: false; insertedTeams: number };

/**
 * Asegura que los equipos de una liga/season están sembrados en BD
 * con su mapping a `team_external_ids` para `source = "api-football"`.
 *
 * - Si ya hay al menos 1 entry para esa source, no hace nada
 *   (`{ skipped: true }`).
 * - Si está vacío, llama `GET /teams?league=X&season=Y`, upserta
 *   `teams` (por code) y crea entries en `team_external_ids`.
 *
 * Pensado para invocarse desde el route handler del sync, justo
 * antes de `syncFixtures`. La primera llamada al endpoint siembra
 * teams + matches en una sola request curl; las siguientes solo
 * actualizan matches. El user no toca scripts a mano.
 *
 * Lanza si la API responde con error o si el formato no es el
 * esperado — el caller lo captura y devuelve 502.
 */
export async function ensureTeamsSeeded(input: {
  db: Database;
  leagueId: number;
  season: number;
  apiKey: string;
  baseUrl: string;
  fetcher?: typeof fetch;
}): Promise<EnsureTeamsSeededResult> {
  const { db, leagueId, season, apiKey, baseUrl } = input;
  const fetcher = input.fetcher ?? fetch;

  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(teamExternalIds)
    .where(eq(teamExternalIds.source, "api-football"));
  if ((existing[0]?.count ?? 0) > 0) {
    return { skipped: true, reason: "already_seeded" };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/teams?league=${leagueId}&season=${season}`;
  const response = await fetcher(url, {
    headers: { "x-apisports-key": apiKey },
  });
  if (!response.ok) {
    throw new Error(`api-football GET /teams returned HTTP ${response.status}`);
  }
  const data = (await response.json()) as ApiFootballTeamsResponse;

  // api-football devuelve 200 OK aunque haya errores del envelope.
  // Detectarlos para dar un mensaje de error útil.
  if (!Array.isArray(data.errors)) {
    const planError = data.errors.plan;
    const rateError = data.errors.rate || data.errors.requests;
    const tokenError = data.errors.token || data.errors.authentication;
    if (planError) {
      throw new Error(
        `api-football plan_limited (league=${leagueId} season=${season}): ${planError}. ` +
          `Cambia MATCH_DATA_LEAGUE_ID y/o MATCH_DATA_SEASON a una combinación que tu plan soporte (free = seasons 2022-2024).`,
      );
    }
    if (rateError) {
      throw new Error(`api-football rate_limited: ${rateError}`);
    }
    if (tokenError) {
      throw new Error(`api-football auth_failed: ${tokenError}`);
    }
    // Otros errores tipados que no esperamos
    throw new Error(
      `api-football GET /teams returned envelope errors: ${JSON.stringify(data.errors)}`,
    );
  }

  if (!data.response || data.response.length === 0) {
    throw new Error(
      `api-football GET /teams returned 0 teams for league=${leagueId} season=${season} (sin errores en envelope, pero sin datos — ¿liga/season correctos?)`,
    );
  }

  // Pre-pasada: resolver colisiones de `code` (UNIQUE en teams).
  const usedCodes = new Set<string>();
  const assignments = data.response.map((item, index) => {
    let code = (item.team.code ?? generateCodeFromName(item.team.name)).toUpperCase();
    if (code.length !== 3 || usedCodes.has(code)) {
      code = (generateCodeFromName(item.team.name).slice(0, 2) + String(index).slice(-1))
        .toUpperCase()
        .slice(0, 3);
    }
    usedCodes.add(code);
    return {
      code,
      name: item.team.name,
      flag: item.team.country ? (COUNTRY_FLAGS[item.team.country] ?? null) : null,
      externalId: String(item.team.id),
    };
  });

  let insertedTeams = 0;
  for (const a of assignments) {
    await db
      .insert(teams)
      .values({ code: a.code, name: a.name, flag: a.flag })
      .onConflictDoUpdate({
        target: teams.code,
        set: { name: a.name, flag: a.flag },
      });

    const found = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.code, a.code))
      .limit(1);
    const teamId = found[0]?.id;
    if (!teamId) continue;

    await db
      .insert(teamExternalIds)
      .values({ teamId, source: "api-football", externalId: a.externalId })
      .onConflictDoUpdate({
        target: [teamExternalIds.source, teamExternalIds.externalId],
        set: { teamId },
      });
    insertedTeams++;
  }

  return { skipped: false, insertedTeams };
}
