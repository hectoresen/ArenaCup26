import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { seedAchievements } from "@/server/achievements/seed";
import { seedWC2022 } from "@/server/seeds/wc2022/seed";

/**
 * Entrypoint único para preparar la BD local con datos de dev.
 *
 *   npm run fixtures
 *
 * Ejecuta tres pasos en orden:
 *
 *   1. `seedAchievements`: catálogo de 24 logros (idempotente, ON CONFLICT).
 *   2. `seedWC2022`: 32 equipos + 24 partidos (truncate + insert).
 *   3. `shiftMatches`: adelanta los kickoffs al futuro y resetea los
 *      partidos a `scheduled` para que el panel `/inicio` muestre la
 *      sección "Próximos partidos" con datos visibles.
 *
 * Solo es útil mientras no tengamos `add-fixture-seed-wc2026`. En
 * producción los partidos reales los aporta el cron de api-football.
 */
async function main() {
  console.log("→ Seeding achievements catalog…");
  const inserted = await seedAchievements(db);
  console.log(`✓ Achievements: ${inserted} rows.\n`);

  console.log("→ Seeding WC 2022 teams + matches…");
  const wc = await seedWC2022(db);
  console.log(`✓ Teams: ${wc.teams}. Matches: ${wc.matches}.\n`);

  console.log("→ Shifting kickoffs to future + reset to scheduled…");
  const result = await db.execute<{ shifted: number }>(sql`
    WITH base AS (
      SELECT min(kickoff_at) AS oldest FROM matches WHERE kickoff_at < now()
    ),
    shifted AS (
      UPDATE matches
      SET
        kickoff_at = kickoff_at + (now() + interval '6 hours' - (SELECT oldest FROM base)),
        status = 'scheduled',
        home_score = NULL,
        away_score = NULL,
        home_score_extra = NULL,
        away_score_extra = NULL,
        penalty_winner_team_id = NULL,
        updated_at = now()
      WHERE kickoff_at < now()
      RETURNING 1
    )
    SELECT count(*)::int AS shifted FROM shifted;
  `);
  console.log(`✓ Shifted ${result[0]?.shifted ?? 0} matches.\n`);

  console.log("Done. Run `npm run dev` and open http://localhost:3000.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[wmundial] fixtures failed:", err);
  process.exit(1);
});
