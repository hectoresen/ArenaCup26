// Restore script para el JSON backup de pre-reset-test.
//
// Estrategia:
//  1. TRUNCATE las tablas modificadas (en orden inverso al de FKs).
//  2. INSERT en orden correcto (padres antes que hijos).
//  3. UPDATE user_points y group_memberships con los snapshots.
//
// Asume:
//  - users, teams, achievement_definitions, friendships, invitations,
//    groups ya están en BD (no se borraron en el reset).
//  - El JSON contiene snapshot completo de las tablas tocadas en el reset.

import fs from "node:fs";
import postgres from "postgres";

const BACKUP_FILE = process.env.BACKUP_FILE;
if (!BACKUP_FILE) throw new Error("BACKUP_FILE env var required");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL env var required");

const dump = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
const sql = postgres(process.env.DATABASE_URL);

async function main() {
  console.log("=== Restoring from", BACKUP_FILE, "===");
  console.log("Snapshot keys:", Object.keys(dump).map((k) => `${k}=${dump[k].length}`).join(", "));

  // 1. Limpiar lo que metimos post-reset (Mundial + bots predicciones)
  console.log("\n→ Limpiando estado post-reset actual...");
  await sql`DELETE FROM point_events`;
  await sql`DELETE FROM predictions`;
  await sql`DELETE FROM match_external_ids`;
  await sql`DELETE FROM matches`;
  await sql`DELETE FROM user_achievements`;
  await sql`DELETE FROM ranking_snapshots`;
  await sql`DELETE FROM notifications`;
  console.log("✓ Tablas modificadas en reset → vacías.");

  // 2. INSERT en orden: matches → match_external_ids → predictions →
  //    point_events → user_achievements → ranking_snapshots → notifications.
  console.log("\n→ Insertando matches…");
  if (dump.matches.length > 0) {
    await sql`INSERT INTO matches ${sql(dump.matches)}`;
  }
  console.log(`✓ ${dump.matches.length} matches restaurados.`);

  console.log("→ Insertando match_external_ids…");
  if (dump.match_external_ids.length > 0) {
    await sql`INSERT INTO match_external_ids ${sql(dump.match_external_ids)}`;
  }
  console.log(`✓ ${dump.match_external_ids.length} match_external_ids restaurados.`);

  console.log("→ Insertando predictions…");
  if (dump.predictions.length > 0) {
    // chunks de 500 para evitar payloads gigantes
    const CHUNK = 500;
    for (let i = 0; i < dump.predictions.length; i += CHUNK) {
      const slice = dump.predictions.slice(i, i + CHUNK);
      await sql`INSERT INTO predictions ${sql(slice)}`;
    }
  }
  console.log(`✓ ${dump.predictions.length} predictions restauradas.`);

  console.log("→ Insertando point_events…");
  if (dump.point_events.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < dump.point_events.length; i += CHUNK) {
      const slice = dump.point_events.slice(i, i + CHUNK);
      await sql`INSERT INTO point_events ${sql(slice)}`;
    }
  }
  console.log(`✓ ${dump.point_events.length} point_events restaurados.`);

  console.log("→ Insertando user_achievements…");
  if (dump.user_achievements.length > 0) {
    await sql`INSERT INTO user_achievements ${sql(dump.user_achievements)}`;
  }
  console.log(`✓ ${dump.user_achievements.length} user_achievements restaurados.`);

  console.log("→ Insertando ranking_snapshots…");
  if (dump.ranking_snapshots.length > 0) {
    await sql`INSERT INTO ranking_snapshots ${sql(dump.ranking_snapshots)}`;
  }
  console.log(`✓ ${dump.ranking_snapshots.length} ranking_snapshots restaurados.`);

  console.log("→ Insertando notifications…");
  if (dump.notifications.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < dump.notifications.length; i += CHUNK) {
      const slice = dump.notifications.slice(i, i + CHUNK);
      await sql`INSERT INTO notifications ${sql(slice)}`;
    }
  }
  console.log(`✓ ${dump.notifications.length} notifications restauradas.`);

  // 3. UPDATE user_points y group_memberships.frozen_* con los snapshots.
  console.log("\n→ Restaurando user_points (snapshot)...");
  for (const up of dump.user_points) {
    await sql`
      UPDATE user_points SET
        total_points = ${up.total_points},
        streak = ${up.streak},
        streak_max = ${up.streak_max},
        correct_count = ${up.correct_count},
        simple_hits = ${up.simple_hits}
      WHERE user_id = ${up.user_id}
    `;
  }
  console.log(`✓ ${dump.user_points.length} user_points restaurados.`);

  console.log("→ Restaurando group_memberships.frozen_*…");
  for (const gm of dump.group_memberships) {
    if (gm.frozen_points === null && gm.frozen_streak_max === null && gm.frozen_simple_hits === null) continue;
    await sql`
      UPDATE group_memberships SET
        frozen_points = ${gm.frozen_points},
        frozen_streak_max = ${gm.frozen_streak_max},
        frozen_simple_hits = ${gm.frozen_simple_hits}
      WHERE id = ${gm.id}
    `;
  }
  console.log("✓ frozen_* restaurados.");

  console.log("\n=== Restore completado ===");
  await sql.end();
}

main().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
