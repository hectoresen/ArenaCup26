/**
 * Script destructivo de QA: borra TODOS los partidos del BD + datos
 * derivados, y deja a los usuarios reales con puntos a 0. Pensado
 * para un reset cuando el calendario tiene basura del seed inicial
 * (WC2022, etc.) y queremos que el próximo sync construya desde 0.
 *
 * Lo que hace, en orden:
 *  1. Cuenta usuarios reales con `point_events` y/o `user_points` no
 *     vacíos. Si hay >0 y NO se pasa `--really-prod`, aborta.
 *  2. `DELETE FROM matches` — cascade a predictions + point_events
 *     (FK con `onDelete: 'cascade'` en schema). `notifications.match_id`
 *     se pone a NULL.
 *  3. Resetea `user_points` de los usuarios reales a 0/0/0/0/0.
 *     Los seed placeholders se restablecen al ejecutar el bootstrap
 *     después de este script (preservan su decoración del ranking).
 *
 * NO toca:
 *  - `users`, `user_achievements`, `friendships`, `invitations`.
 *  - Tabla `teams` (se conservan; el sync los reutiliza por externalId).
 *
 * Uso:
 *
 *   Dry-run (solo plan, sin tocar nada):
 *     DATABASE_URL=postgresql://... npx tsx scripts/dev-reset-matches.ts
 *
 *   QA (BD sin datos de usuarios reales):
 *     DATABASE_URL=postgresql://... npx tsx scripts/dev-reset-matches.ts --confirm
 *
 *   Prod (CONFIRMA QUE QUIERES BORRAR DATOS DE USUARIOS REALES):
 *     DATABASE_URL=postgresql://... npx tsx scripts/dev-reset-matches.ts --confirm --really-prod
 *
 * Ver `docs/incident-2026-05-18-data-wipe.md` para contexto histórico
 * sobre por qué este guard existe.
 */
import { db } from "@/server/db/client";
import { matches, pointEvents, userPoints } from "@/server/db/schema";
import { sql } from "drizzle-orm";

const SEED_PLACEHOLDER_PREFIX = "00000000-0000-4000-a000-";

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const reallyProd = process.argv.includes("--really-prod");

  // Cuenta de usuarios reales con datos: si hay >0, este script puede
  // ser destructivo en producción. Bloqueamos a menos que se pase el
  // segundo flag explícito.
  const realPointEventsRows = await db
    .select({ count: sql<number>`count(distinct ${pointEvents.userId})::int` })
    .from(pointEvents)
    .where(sql`${pointEvents.userId}::text NOT LIKE ${SEED_PLACEHOLDER_PREFIX + "%"}`);
  const realUsersWithEvents = realPointEventsRows[0]?.count ?? 0;

  const realUserPointsRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userPoints)
    .where(
      sql`${userPoints.userId}::text NOT LIKE ${SEED_PLACEHOLDER_PREFIX + "%"}
          AND ${userPoints.totalPoints} > 0`,
    );
  const realUsersWithPoints = realUserPointsRows[0]?.count ?? 0;

  const realUsersTouched = Math.max(realUsersWithEvents, realUsersWithPoints);

  if (!confirmed) {
    console.log("Plan:");
    console.log("  1. DELETE FROM matches  (cascade → predictions, point_events)");
    console.log("  2. UPDATE user_points SET total_points=0,...  para usuarios reales");
    console.log("     (los 7 placeholders se restablecen vía bootstrap después)");
    console.log("");
    console.log(`Estado actual: ${realUsersTouched} usuarios REALES tienen datos de scoring.`);
    if (realUsersTouched > 0) {
      console.log("");
      console.log("⚠  Si ejecutas esto, ESOS usuarios pierden sus puntos.");
      console.log("⚠  Requiere `--confirm --really-prod` para proceder.");
    }
    console.log("");
    console.log("Ejecuta con --confirm (+ --really-prod si hay usuarios reales) para aplicar.");
    process.exit(0);
  }

  if (realUsersTouched > 0 && !reallyProd) {
    console.error(
      `❌ ABORT: ${realUsersTouched} usuarios reales tienen puntos/predicciones. ` +
        "Si REALMENTE quieres borrarlos, añade `--really-prod` al comando. " +
        "Antes de hacerlo, considera: (a) ¿hay backup reciente?, " +
        "(b) ¿es necesario? El script `recompute-user-points.ts` puede recalcular " +
        "sin destruir; los datos quedarán inconsistentes si no se restaura desde backup.",
    );
    process.exit(2);
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
