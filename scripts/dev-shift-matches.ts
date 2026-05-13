import { db } from "@/server/db/client";
import { sql } from "drizzle-orm";

/**
 * Adelanta los `kickoffAt` de todos los matches pasados al rango
 * "ahora-en-adelante" para que `/inicio` y `/u/<username>` tengan
 * datos visibles en local.
 *
 * - Calcula el delta entre `now()` y el match más antiguo en BD.
 * - Aplica ese delta + 6 horas (para que el primer match esté
 *   "Hoy en 6h") a todos los kickoffs `< now()`.
 * - Idempotente: ejecutarlo dos veces deja todo en el futuro la primera
 *   vez; la segunda no hace nada (no hay matches < now() ya).
 *
 * No es seed canónico — es un helper de dev. En producción los
 * kickoffs reales los maneja `add-fixture-seed-wc2026` (pendiente).
 */
async function main() {
  const summary = await db.execute<{ count: number; oldest: Date | null }>(sql`
    SELECT count(*)::int AS count, min(kickoff_at) AS oldest
    FROM matches
    WHERE kickoff_at < now();
  `);
  const row = summary[0];

  if (!row || !row.count) {
    console.log("✓ Sin matches en el pasado. Nada que hacer.");
    process.exit(0);
  }

  console.log(`Encontrados ${row.count} matches con kickoff < now(). Más antiguo: ${row.oldest}.`);
  console.log("Aplicando shift para que el primero caiga ~6h en el futuro…");

  const result = await db.execute<{ shifted: number }>(sql`
    WITH base AS (
      SELECT min(kickoff_at) AS oldest FROM matches WHERE kickoff_at < now()
    ),
    shifted AS (
      UPDATE matches
      SET kickoff_at = kickoff_at + (now() + interval '6 hours' - (SELECT oldest FROM base))
      WHERE kickoff_at < now()
      RETURNING 1
    )
    SELECT count(*)::int AS shifted FROM shifted;
  `);

  console.log(`✓ ${result[0]?.shifted ?? 0} matches actualizados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[wmundial] dev-shift-matches failed:", err);
  process.exit(1);
});
