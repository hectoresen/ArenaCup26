import { eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { matches, predictions, teams } from "@/server/db/schema";
import { WC2022_MATCHES } from "./matches";
import { WC2022_TEAMS } from "./teams";

/**
 * Seed del Mundial Qatar 2022 sobre la BD apuntada por DATABASE_URL.
 *
 * Idempotente sobre teams (upsert por code), destructivo sobre matches
 * (truncate + insert) para garantizar consistencia con el catálogo.
 * Como matches se trunca, predictions también se borra (FK).
 *
 * Pensado para entornos de **dev y staging** donde se quiere replay
 * realista del Mundial 2022 contra el scoring engine. NO ejecutar contra
 * BD de producción con predicciones reales.
 */
export async function seedWC2022(db: Database): Promise<{
  teams: number;
  matches: number;
}> {
  // 1. Limpiar dependientes en orden FK
  await db.delete(predictions);
  await db.delete(matches);

  // 2. Upsert teams por code; recolectar id por code
  const teamIdByCode = new Map<string, string>();
  for (const team of WC2022_TEAMS) {
    await db
      .insert(teams)
      .values({ code: team.code, name: team.name, flag: team.flag })
      .onConflictDoUpdate({
        target: teams.code,
        set: { name: team.name, flag: team.flag },
      });

    const row = await db.query.teams.findFirst({
      where: eq(teams.code, team.code),
      columns: { id: true, code: true },
    });
    if (!row) {
      throw new Error(`Failed to resolve team id for code ${team.code}`);
    }
    teamIdByCode.set(row.code, row.id);
  }

  // 3. Insert matches resolviendo team ids
  let matchCount = 0;
  for (const match of WC2022_MATCHES) {
    const homeId = teamIdByCode.get(match.homeCode);
    const awayId = teamIdByCode.get(match.awayCode);
    if (!homeId || !awayId) {
      throw new Error(
        `Missing team for match ${match.slug}: ${match.homeCode} vs ${match.awayCode}`,
      );
    }
    const penaltyWinnerId = match.penaltyWinnerCode
      ? (teamIdByCode.get(match.penaltyWinnerCode) ?? null)
      : null;

    await db.insert(matches).values({
      stage: match.stage,
      homeTeamId: homeId,
      awayTeamId: awayId,
      kickoffAt: new Date(match.kickoffAt),
      status: "finished",
      homeScore: match.scoreAt90.home,
      awayScore: match.scoreAt90.away,
      homeScoreExtra: match.scoreAtExtra?.home ?? null,
      awayScoreExtra: match.scoreAtExtra?.away ?? null,
      penaltyWinnerTeamId: penaltyWinnerId,
    });
    matchCount++;
  }

  return { teams: WC2022_TEAMS.length, matches: matchCount };
}
