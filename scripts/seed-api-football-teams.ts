import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { teamExternalIds, teams } from "@/server/db/schema";

/**
 * Trae los equipos de la liga/season configurada en `.env`
 * (`MATCH_DATA_LEAGUE_ID`, `MATCH_DATA_SEASON`) desde api-football y
 * los siembra en BD:
 *
 *   1. Upsert en `teams` (por `code` único 3-letras).
 *   2. Upsert en `team_external_ids` (source=api-football,
 *      external_id = id de api-football del team).
 *
 * Esto es paso previo único antes del primer
 * `POST /api/cron/sync-fixtures`. Sin estas filas, el reconciler no
 * sabría mapear el `homeTeam.externalId` del fixture a un team UUID
 * y todos los matches saltarían como "team_not_mapped".
 *
 *   npm run seed:teams
 *
 * Idempotente — relanzarlo no daña; refresca name/flag si cambian.
 *
 * El emoji bandera se asigna desde un mini-mapa nombre-de-país →
 * emoji. Para La Liga todos son ES; cuando añadamos otras ligas,
 * extender el mapa.
 */

type ApiFootballTeamsResponse = {
  response: Array<{
    team: {
      id: number;
      name: string;
      code: string | null;
      country: string | null;
      logo: string | null;
    };
  }>;
};

const COUNTRY_FLAGS: Record<string, string> = {
  Spain: "🇪🇸",
  England: "🇬🇧",
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

async function main() {
  if (!env.API_FOOTBALL_KEY) {
    console.error("❌ Falta API_FOOTBALL_KEY en .env");
    process.exit(1);
  }

  const league = env.MATCH_DATA_LEAGUE_ID;
  const season = env.MATCH_DATA_SEASON;
  const url = `${env.API_FOOTBALL_BASE_URL.replace(/\/+$/, "")}/teams?league=${league}&season=${season}`;

  console.log(`→ Trayendo teams de league=${league} season=${season}…`);
  const response = await fetch(url, {
    headers: { "x-apisports-key": env.API_FOOTBALL_KEY },
  });

  if (!response.ok) {
    console.error(`❌ HTTP ${response.status} de api-football`);
    process.exit(1);
  }

  const data = (await response.json()) as ApiFootballTeamsResponse;
  if (!data.response || data.response.length === 0) {
    console.error("❌ Respuesta vacía. ¿league/season correctos?");
    process.exit(1);
  }

  console.log(`  ${data.response.length} teams recibidos.\n`);

  // Pre-pasada: detectar colisiones de `code`. Si existen, generamos
  // sufijo con la posición para garantizar unicidad en este batch.
  const usedCodes = new Set<string>();
  const assignments = data.response.map((item, index) => {
    let code = (item.team.code ?? generateCodeFromName(item.team.name)).toUpperCase();
    if (code.length !== 3 || usedCodes.has(code)) {
      // colision o longitud inválida → generar uno del nombre + índice
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

  let inserted = 0;
  let updated = 0;
  for (const a of assignments) {
    // 1. Upsert team
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
    if (!teamId) {
      console.warn(`  ⚠ team ${a.code} (${a.name}) no encontrado tras upsert`);
      continue;
    }

    // 2. Upsert mapping
    const existingMapping = await db
      .select({ teamId: teamExternalIds.teamId })
      .from(teamExternalIds)
      .where(eq(teamExternalIds.externalId, a.externalId))
      .limit(1);

    if (existingMapping.length === 0) {
      await db
        .insert(teamExternalIds)
        .values({
          teamId,
          source: "api-football",
          externalId: a.externalId,
        });
      inserted++;
    } else {
      updated++;
    }
    console.log(`  ✓ ${a.code} · ${a.name.padEnd(28)} (api-football id=${a.externalId})`);
  }

  console.log(
    `\nDone. ${inserted} mappings nuevos, ${updated} ya existían. Ahora puedes lanzar:`,
  );
  console.log(
    `  curl -X POST ${env.NEXT_PUBLIC_APP_URL}/api/cron/sync-fixtures\n`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[wmundial] seed:teams failed:", err);
  process.exit(1);
});
