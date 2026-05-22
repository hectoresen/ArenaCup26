/**
 * Script destructivo de QA / pre-Mundial: borra TODOS los partidos
 * del BD + datos derivados, y deja a los usuarios con puntos a 0.
 *
 * Dos modos:
 *
 *   **Modo `matches-only`** (default, sin `--for-tournament`):
 *     1. `DELETE FROM matches` — cascade a `predictions` +
 *        `point_events` + `match_external_ids`. `notifications.match_id`
 *        se pone a NULL.
 *     2. `UPDATE user_points` → 0/0/0/0/0 para todos los usuarios.
 *
 *   **Modo `tournament-reset`** (con `--for-tournament`):
 *     Lo anterior +:
 *     3. `DELETE FROM user_achievements` — todos los logros desbloqueados
 *        de todos los usuarios. Las definitions (`achievement_definitions`)
 *        se preservan.
 *     4. `DELETE FROM ranking_snapshots` — todo el histórico de ranking.
 *     5. `UPDATE group_memberships SET frozen_* = NULL` — limpia los
 *        snapshots de puntos congelados de ex-miembros para que no
 *        contaminen el ranking del grupo en el nuevo torneo.
 *     6. `DELETE FROM notifications` con `match_id IS NULL` (huérfanas
 *        del paso 1) y `kind IN ('match_finished', 'prediction_locked',
 *        'achievement_unlocked')` — la bandeja queda limpia.
 *
 * En ambos modos NO se tocan: `users`, `friendships`, `invitations`,
 * `groups`, `group_memberships` (solo se limpian los frozen_*), `teams`,
 * `team_external_ids`, `achievement_definitions`, `sessions`, `accounts`.
 *
 * Uso:
 *
 *   Dry-run (solo plan, sin tocar nada):
 *     DATABASE_URL=postgresql://... npx tsx scripts/dev-reset-matches.ts
 *
 *   QA básico (solo matches/points):
 *     DATABASE_URL=postgresql://... npx tsx scripts/dev-reset-matches.ts --confirm
 *
 *   Reset pre-Mundial completo (manteniendo cuentas/amistades/grupos):
 *     DATABASE_URL=postgresql://... npx tsx scripts/dev-reset-matches.ts \
 *       --confirm --really-prod --for-tournament
 *
 * Ver `docs/pre-mundial-runbook.md` para el procedimiento end-to-end
 * y `docs/incident-2026-05-18-data-wipe.md` para contexto histórico
 * del guardrail.
 */
import { db } from "@/server/db/client";
import {
  groupMemberships,
  matches,
  notifications,
  pointEvents,
  rankingSnapshots,
  userAchievements,
  userPoints,
  users,
} from "@/server/db/schema";
import { eq, inArray, isNull, or, sql } from "drizzle-orm";

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const reallyProd = process.argv.includes("--really-prod");
  const forTournament = process.argv.includes("--for-tournament");

  // Conteo del impacto en HUMANOS (is_bot = false). Los bots cuentan
  // como "datos sintéticos" — su reset es esperado y el bootstrap los
  // repuebla. Lo que motiva el guardrail `--really-prod` es no destruir
  // puntos de humanos por accidente.
  const humansWithEventsRows = await db
    .select({ count: sql<number>`count(distinct ${pointEvents.userId})::int` })
    .from(pointEvents)
    .innerJoin(users, eq(users.id, pointEvents.userId))
    .where(eq(users.isBot, false));
  const humansWithEvents = humansWithEventsRows[0]?.count ?? 0;

  const humansWithPointsRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userPoints)
    .innerJoin(users, eq(users.id, userPoints.userId))
    .where(sql`${users.isBot} = false AND ${userPoints.totalPoints} > 0`);
  const humansWithPoints = humansWithPointsRows[0]?.count ?? 0;

  const realUsersTouched = Math.max(humansWithEvents, humansWithPoints);

  if (!confirmed) {
    console.log("Plan:");
    console.log("  1. DELETE FROM point_events  (FK 'set null', borrar explícito)");
    console.log("  2. DELETE FROM matches       (cascade → predictions, match_external_ids)");
    console.log("  3. UPDATE user_points → 0/0/0/0/0  para todos los usuarios");
    if (forTournament) {
      console.log("  4. DELETE FROM user_achievements (todos los logros desbloqueados)");
      console.log("  5. DELETE FROM ranking_snapshots (todo el histórico de ranking)");
      console.log("  6. UPDATE group_memberships SET frozen_* = NULL  (limpia ex-miembros)");
      console.log("  7. DELETE FROM notifications  (huérfanas + scoring/achievements)");
    }
    console.log("");
    console.log(
      `Estado actual: ${realUsersTouched} HUMANOS con datos de scoring (los bots se resetean siempre).`,
    );
    if (realUsersTouched > 0) {
      console.log("");
      console.log("⚠  Si ejecutas esto, ESOS humanos pierden sus puntos.");
      if (forTournament) {
        console.log("⚠  Y también todos sus logros, historial de ranking y notificaciones.");
      }
      console.log("⚠  Requiere `--confirm --really-prod` para proceder.");
    }
    console.log("");
    const flags = forTournament ? "--confirm --really-prod --for-tournament" : "--confirm";
    console.log(`Ejecuta con \`${flags}\` para aplicar.`);
    process.exit(0);
  }

  if (realUsersTouched > 0 && !reallyProd) {
    console.error(
      `❌ ABORT: ${realUsersTouched} humanos tienen puntos/predicciones. ` +
        "Si REALMENTE quieres borrarlos, añade `--really-prod` al comando. " +
        "Antes de hacerlo, considera: (a) ¿hay backup reciente?, " +
        "(b) ¿es necesario? El script `recompute-user-points.ts` puede recalcular " +
        "sin destruir; los datos quedarán inconsistentes si no se restaura desde backup.",
    );
    process.exit(2);
  }

  console.log("→ Borrando point_events (FK con set null, no cascade)...");
  // `point_events.match_id` tiene `onDelete: 'set null'` por design (queremos
  // conservar el histórico de scoring aunque el match se borre). Pero en un
  // reset pre-Mundial los puntos viejos contaminan los nuevos cálculos —
  // mejor borrarlos explícitamente ANTES del DELETE de matches.
  const pointEventsDel = await db.delete(pointEvents).returning({ id: pointEvents.id });
  console.log(`✓ ${pointEventsDel.length} point_events eliminados.`);

  console.log("→ Borrando matches (cascade)...");
  await db.delete(matches);
  console.log("✓ matches borrados (cascade aplicó a predictions + match_external_ids).");

  console.log("→ Reseteando user_points para todos los usuarios...");
  // Reset total: bots y humanos. Los bots recuperan sus puntos cuando
  // `processFinishedMatch` corra sobre las predicciones que el
  // bootstrap reseedea con SEED_BOT_PREDICTIONS=true tras el sync del
  // Mundial. El filtro `NOT LIKE prefix` antiguo (placeholders
  // legacy con prefijo `a000-`) no aplica desde la migración a
  // `add-bot-users` — `migrateOldPlaceholders` los limpió.
  await db.update(userPoints).set({
    totalPoints: 0,
    streak: 0,
    streakMax: 0,
    correctCount: 0,
    simpleHits: 0,
  });
  console.log("✓ user_points reseteados.");

  if (forTournament) {
    console.log("→ Borrando user_achievements...");
    const userAchDel = await db.delete(userAchievements).returning({ id: userAchievements.userId });
    console.log(`✓ ${userAchDel.length} filas de user_achievements eliminadas.`);

    console.log("→ Borrando ranking_snapshots...");
    const snapDel = await db.delete(rankingSnapshots).returning({ id: rankingSnapshots.userId });
    console.log(`✓ ${snapDel.length} filas de ranking_snapshots eliminadas.`);

    console.log("→ Limpiando frozen_* en group_memberships...");
    const frozenUpd = await db
      .update(groupMemberships)
      .set({
        frozenPoints: null,
        frozenStreakMax: null,
        frozenSimpleHits: null,
      })
      .returning({ id: groupMemberships.id });
    console.log(`✓ ${frozenUpd.length} membresías con frozen_* reseteado.`);

    console.log("→ Limpiando notifications huérfanas y de scoring...");
    // `match_id IS NULL` cubre las huérfanas del paso 1 (cuando borramos
    // matches, las notifs `match_finished` quedaron con match_id null).
    // El resto las filtramos por `kind` para no borrar friend_request,
    // group_invited, etc. — esas son meta-info que el user puede querer
    // conservar (e.g. solicitudes pendientes).
    const notifDel = await db
      .delete(notifications)
      .where(
        or(
          isNull(notifications.matchId),
          inArray(notifications.kind, [
            "match_finished",
            "prediction_locked",
            "achievement_unlocked",
            "prediction_sent",
          ]),
        ),
      )
      .returning({ id: notifications.id });
    console.log(`✓ ${notifDel.length} notificaciones eliminadas.`);
  }

  console.log("");
  console.log("Siguientes pasos:");
  console.log("  1. (Si vienes de pre-Mundial) Cambia env vars Railway:");
  console.log("       MATCH_DATA_MODE=season");
  console.log("       MATCH_DATA_LEAGUE_ID=1");
  console.log("       MATCH_DATA_SEASON=2026");
  console.log("       MATCH_DATA_LEAGUE_FILTER= (vacío)");
  console.log("  2. Trigger manual del cron `match-data-sync` para popular el calendario.");
  console.log("  3. Trigger `npm run bootstrap` con SEED_BOT_PREDICTIONS=true para");
  console.log("     reseedear predicciones de bots sobre los nuevos partidos.");
  console.log("");
  console.log("Ver docs/pre-mundial-runbook.md para el procedimiento completo.");
  process.exit(0);
}

main().catch((err) => {
  console.error("dev-reset-matches failed:", err);
  process.exit(1);
});
