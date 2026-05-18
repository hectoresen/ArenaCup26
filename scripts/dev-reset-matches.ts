/**
 * Script destructivo de QA: borra TODOS los partidos del BD + datos
 * derivados, y deja a los usuarios reales con puntos a 0. Pensado
 * para un reset cuando el calendario tiene basura del seed inicial
 * (WC2022, etc.) y queremos que el próximo sync construya desde 0.
 *
 * Lo que hace, en orden:
 *  1. `DELETE FROM matches`       — cascade a predictions + point_events
 *                                    (FK con `onDelete: 'cascade'` en
 *                                    schema). `notifications.match_id`
 *                                    se pone a NULL.
 *  2. Resetea `user_points` de los **usuarios reales** a 0/0/0/0/0.
 *     Los seed placeholders se restablecen al ejecutar el bootstrap
 *     después de este script (preservan su decoración del ranking).
 *
 * NO toca:
 *  - `users`, `user_achievements`, `friendships`, `invitations`.
 *  - Tabla `teams` (se conservan; el sync los reutiliza por externalId).
 *
 * Uso (UNA SOLA VEZ, con cuidado):
 *
 *     DATABASE_URL=postgresql://... npx tsx scripts/dev-reset-matches.ts --confirm
 *
 * Sin `--confirm` solo imprime el plan y aborta.
 */
import { db } from "@/server/db/client";
import { matches, userPoints } from "@/server/db/schema";
import { sql } from "drizzle-orm";

const SEED_PLACEHOLDER_PREFIX = "00000000-0000-4000-a000-";

async function main() {
  const confirmed = process.argv.includes("--confirm");

  if (!confirmed) {
    console.log("Plan:");
    console.log("  1. DELETE FROM matches  (cascade → predictions, point_events)");
    console.log("  2. UPDATE user_points SET total_points=0,...  para usuarios reales");
    console.log("     (los 7 placeholders se restablecen vía bootstrap después)");
    console.log("");
    console.log("Ejecuta con --confirm para aplicar.");
    process.exit(0);
  }

  console.log("→ Borrando matches (cascade)...");
  await db.delete(matches);
  console.log("✓ matches borrados (cascade aplicó a predictions + point_events).");

  console.log("→ Reseteando user_points de usuarios reales...");
  // Solo los users NO-placeholder: los placeholders se re-aplican
  // con `seedLeaderboardPlaceholders` en el siguiente deploy.
  await db
    .update(userPoints)
    .set({
      totalPoints: 0,
      streak: 0,
      streakMax: 0,
      correctCount: 0,
      simpleHits: 0,
    })
    .where(sql`${userPoints.userId}::text NOT LIKE ${SEED_PLACEHOLDER_PREFIX + "%"}`);
  console.log("✓ user_points reseteados para usuarios reales.");

  console.log("");
  console.log("Siguiente paso recomendado:");
  console.log("  1. Bootstrap re-aplica seeds placeholders en el próximo deploy");
  console.log("     (o lanza `npx tsx scripts/bootstrap.ts` localmente).");
  console.log("  2. Dispara manualmente el workflow `match-data-sync` en");
  console.log("     GitHub Actions para repoblar el calendario.");
  process.exit(0);
}

main().catch((err) => {
  console.error("dev-reset-matches failed:", err);
  process.exit(1);
});
