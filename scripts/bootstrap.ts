import { seedAchievements } from "@/server/achievements/seed";
import { db } from "@/server/db/client";

/**
 * Bootstrap idempotente que se ejecuta como parte del pre-deploy en
 * Railway. Se encarga de poner en BD lo que es **referencia estática
 * del producto** (no datos de usuario): hoy solo el catálogo de 24
 * logros.
 *
 *   1. `seedAchievements`: ON CONFLICT DO UPDATE → repetir el
 *      bootstrap nunca duplica filas; solo refresca títulos /
 *      descripciones si cambiaron.
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
  const inserted = await seedAchievements(db);
  console.log(`✓ Achievements ready (${inserted} rows reconciled).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[wmundial] bootstrap failed:", err);
  process.exit(1);
});
