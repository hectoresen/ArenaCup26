import { seedAchievements } from "@/server/achievements/seed";
import { db } from "@/server/db/client";
import { seedLeaderboardPlaceholders } from "@/server/seeds/leaderboard-placeholders";

/**
 * Bootstrap idempotente que se ejecuta como parte del pre-deploy en
 * Railway. Pone en BD lo que es **referencia estática del producto**
 * o decoración del leaderboard durante la fase de pruebas:
 *
 *   1. `seedAchievements`: ON CONFLICT DO UPDATE → repetir el
 *      bootstrap nunca duplica filas; solo refresca títulos /
 *      descripciones si cambiaron.
 *
 *   2. `seedLeaderboardPlaceholders`: 3 usuarios fijos (Carlos,
 *      Layla, Tomás) con puntos altos y algunos logros. Decoran el
 *      ranking cuando todavía no hay tráfico real, y son clicables
 *      (`/u/carlos-mendoza`, etc.) porque viven como filas reales.
 *
 * Datos dinámicos (teams, matches) NO se siembran aquí — vienen del
 * primer sync con api-football vía `/api/cron/sync-fixtures`.
 *
 * El user nunca debería correr este script a mano. Lo lanza el
 * pre-deploy:
 *
 *     npm run db:migrate && npm run bootstrap
 */
async function main() {
  console.log("→ Bootstrap: seeding achievements catalog…");
  const insertedAchievements = await seedAchievements(db);
  console.log(`✓ Achievements ready (${insertedAchievements} rows reconciled).`);

  console.log("→ Bootstrap: seeding leaderboard placeholder users…");
  const insertedPlaceholders = await seedLeaderboardPlaceholders(db);
  console.log(`✓ Placeholders ready (${insertedPlaceholders} users reconciled).`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[wmundial] bootstrap failed:", err);
  process.exit(1);
});
