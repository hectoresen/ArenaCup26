import { db } from "@/server/db/client";
import { sql } from "drizzle-orm";

/**
 * Pone el primer match futuro en `status='live'` con un marcador
 * inventado (1-0) para validar la live card de `/inicio` sin esperar
 * a que el cron real lo sincronice. Idempotente: si ya hay un live,
 * lo deja como está.
 *
 *   npm run dev:set-live          # 1-0 al primero
 *   HOME=2 AWAY=1 npm run dev:set-live   # marcador custom
 */
async function main() {
  const home = Number(process.env.HOME_SCORE ?? 1);
  const away = Number(process.env.AWAY_SCORE ?? 0);

  const existing = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM matches WHERE status = 'live' LIMIT 1;
  `);
  if (existing[0]) {
    console.log(`Ya hay un match en live (${existing[0].id.slice(0, 8)}). Nada que hacer.`);
    process.exit(0);
  }

  const updated = await db.execute<{ id: string }>(sql`
    UPDATE matches
    SET status = 'live', home_score = ${home}, away_score = ${away}, updated_at = now()
    WHERE id = (
      SELECT id FROM matches
      WHERE kickoff_at > now() AND status = 'scheduled'
      ORDER BY kickoff_at ASC
      LIMIT 1
    )
    RETURNING id::text;
  `);

  if (!updated[0]) {
    console.log(
      "❌ No hay matches futuros con status='scheduled' para poner en live. Lanza `npm run fixtures` primero.",
    );
    process.exit(1);
  }

  console.log(
    `✓ Match ${updated[0].id.slice(0, 8)} en live con ${home}-${away}. Refresca /inicio.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[wmundial] dev:set-live failed:", err);
  process.exit(1);
});
