import { getUpcomingMatches } from "@/server/dashboard/queries";
import { db } from "@/server/db/client";
import { sql } from "drizzle-orm";

/**
 * Diagnóstico rápido para entender por qué /inicio no muestra
 * partidos. Imprime:
 *
 *   1. Cuántos matches hay en BD por status.
 *   2. Comparación now() vs el primer/último kickoff.
 *   3. Cuántos cumplen el filtro (`kickoff > now()` AND status in
 *      [scheduled, scheduled-tbd, prediction-locked]).
 *   4. Resultado del propio `getUpcomingMatches` para un userId
 *      ficticio (no importa el usuario para upcoming).
 */
async function main() {
  console.log("\n=== 1. Conteo por status ===");
  const byStatus = await db.execute<{ status: string; count: number }>(sql`
    SELECT status::text, count(*)::int AS count
    FROM matches
    GROUP BY status
    ORDER BY count DESC;
  `);
  for (const r of byStatus) {
    console.log(`  ${r.status.padEnd(20)} ${r.count}`);
  }

  console.log("\n=== 2. Ventana temporal ===");
  const window = await db.execute<{
    now: Date;
    first: Date | null;
    last: Date | null;
  }>(sql`SELECT now() AS now, min(kickoff_at) AS first, max(kickoff_at) AS last FROM matches`);
  const w = window[0];
  console.log(`  now()  = ${w?.now}`);
  console.log(`  first  = ${w?.first}`);
  console.log(`  last   = ${w?.last}`);

  console.log("\n=== 3. Matches que pasan el filtro de upcoming ===");
  const filterCount = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count
    FROM matches
    WHERE kickoff_at > now()
      AND status IN ('scheduled', 'scheduled-tbd', 'prediction-locked');
  `);
  console.log(`  count = ${filterCount[0]?.count}`);

  console.log("\n=== 4. Resultado de getUpcomingMatches (UUID ficticio) ===");
  const upcoming = await getUpcomingMatches(db, "00000000-0000-0000-0000-000000000000", 5);
  console.log(`  upcoming.length = ${upcoming.length}`);
  for (const m of upcoming) {
    console.log(
      `  - ${m.matchId.slice(0, 8)} ${m.kickoffAt.toISOString()} ${m.homeTeam?.name ?? "?"} vs ${m.awayTeam?.name ?? "?"}`,
    );
  }

  console.log("\n=== 5. Sample row crudo (primer match futuro) ===");
  const raw = await db.execute<{
    id: string;
    status: string;
    kickoff_at: Date;
    home_team_id: string | null;
    away_team_id: string | null;
  }>(sql`
    SELECT id::text, status::text, kickoff_at, home_team_id::text, away_team_id::text
    FROM matches
    WHERE kickoff_at > now()
    ORDER BY kickoff_at
    LIMIT 1;
  `);
  console.log(`  ${JSON.stringify(raw[0], null, 2)}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[arenacup26] diagnose failed:", err);
  process.exit(1);
});
