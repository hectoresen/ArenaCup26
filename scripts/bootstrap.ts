import { backfillTeamSpirit } from "@/server/achievements/backfill-team-spirit";
import { seedAchievements } from "@/server/achievements/seed";
import { seedBotUsers } from "@/server/bots/seed";
import { seedBotPredictions } from "@/server/bots/seed-predictions";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { inArray } from "drizzle-orm";

/**
 * Bootstrap idempotente que se ejecuta como parte del pre-deploy en
 * Railway. Pone en BD lo que es **referencia estática del producto**
 * o decoración del leaderboard durante la fase de pruebas:
 *
 *   1. `seedAchievements`: ON CONFLICT DO UPDATE → repetir el
 *      bootstrap nunca duplica filas; solo refresca títulos /
 *      descripciones si cambiaron.
 *
 *   2. `seedBotUsers`: reconcilia los 27 bots del catálogo
 *      (`add-bot-users`, 2026-05-19) que pueblan el ranking durante
 *      el cold-start. Idempotente. NO se sienten como mocks: son
 *      filas reales con perfil completo navegable. Ver
 *      `docs/bots.md`.
 *
 *   3. `seedBotPredictions` (opcional): solo si `SEED_BOT_PREDICTIONS=true`.
 *      Para cada bot × cada partido de fase de grupos disponible,
 *      genera una predicción aleatoria según el `style` del bot.
 *      Activación manual antes del kickoff del Mundial — NO en
 *      cada deploy.
 *
 *   4. `migrateOldPlaceholders`: una sola vez post-deploy. Borra
 *      los 7 placeholders previos (`seed-*` IDs con prefijo
 *      `a000-`) que se reemplazan por los bots nuevos (prefijo
 *      `b000-`). Si ya están borrados, no-op.
 *
 *   5. `backfillTeamSpirit`: reconcilia el logro `team-spirit` para
 *      usuarios con grupos activos sin él (post-incident del gate
 *      bypass — ver `decisions.md` 14.16).
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

  console.log("→ Bootstrap: migrating old leaderboard placeholders…");
  const removed = await migrateOldPlaceholders();
  if (removed > 0) {
    console.log(`✓ Removed ${removed} legacy placeholder user(s).`);
  } else {
    console.log("✓ No legacy placeholders to remove.");
  }

  console.log("→ Bootstrap: seeding 27 bot users…");
  const botResult = await seedBotUsers(db);
  console.log(`✓ Bots reconciled — created=${botResult.created}, updated=${botResult.updated}.`);

  if (process.env.SEED_BOT_PREDICTIONS === "true") {
    console.log("→ Bootstrap: seeding bot predictions (SEED_BOT_PREDICTIONS=true)…");
    const predResult = await seedBotPredictions(db);
    console.log(
      `✓ Bot predictions — created=${predResult.predictionsCreated}, matches=${predResult.matchesScanned}, bots=${predResult.botsProcessed}.`,
    );
  } else {
    console.log("→ Skipping bot predictions seed (set SEED_BOT_PREDICTIONS=true to run).");
  }

  console.log("→ Bootstrap: backfilling team-spirit for users with active groups…");
  const backfilled = await backfillTeamSpirit(db);
  console.log(`✓ Team-spirit backfilled for ${backfilled} user(s).`);

  process.exit(0);
}

/**
 * Los 7 placeholders previos (Carlos, Layla, Tomás, etc) usaban IDs
 * con prefijo `00000000-0000-4000-a000-...`. Los reemplazan los 27
 * bots nuevos (`b000-...`). Esta migration borra los viejos en el
 * primer deploy post-add-bot-users; subsequente runs son no-op.
 *
 * ON DELETE CASCADE en FKs (predictions, point_events,
 * user_achievements, etc) se encarga de limpiar dependencias.
 */
async function migrateOldPlaceholders(): Promise<number> {
  const OLD_IDS = [
    "00000000-0000-4000-a000-000000000001",
    "00000000-0000-4000-a000-000000000002",
    "00000000-0000-4000-a000-000000000003",
    "00000000-0000-4000-a000-000000000004",
    "00000000-0000-4000-a000-000000000005",
    "00000000-0000-4000-a000-000000000006",
    "00000000-0000-4000-a000-000000000007",
  ];
  const deleted = await db
    .delete(users)
    .where(inArray(users.id, OLD_IDS))
    .returning({ id: users.id });
  return deleted.length;
}

main().catch((err) => {
  console.error("[arenacup26] bootstrap failed:", err);
  process.exit(1);
});
