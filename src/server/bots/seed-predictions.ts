import { and, eq, ne, inArray } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { matches, predictions, users } from "@/server/db/schema";
import { BOT_CATALOG } from "./catalog";
import { generatePrediction } from "./predict";

/**
 * Siembra predicciones para todos los bots × todos los partidos de
 * fase de grupos disponibles. Idempotente: si una predicción ya
 * existe para `(userId, matchId)`, no la duplica ni la sobreescribe.
 *
 * IMPORTANTE: solo se ejecuta cuando el partido NO está finalizado
 * todavía (los bots no "predicen" partidos ya jugados). El status
 * `finished` queda excluido. El status `live` también — si el
 * script se lanza tarde, los bots no llegan a tiempo y se quedan
 * fuera para ese match (igual que un humano que llegó tarde).
 *
 * Personalidad de predicción según `style` del catálogo — ver
 * `predict.ts`.
 *
 * `submitted_at` aleatorio en una ventana de ±30 min del momento
 * del script, para que no aparezcan 27 predicciones al mismo
 * segundo en `/u/<bot>` (sospechoso).
 *
 * Output: `{ predictionsCreated, matchesScanned, botsProcessed }`.
 */
export async function seedBotPredictions(db: Database): Promise<{
  predictionsCreated: number;
  matchesScanned: number;
  botsProcessed: number;
}> {
  // 1) Encontrar los bots en BD (deben existir tras `seedBotUsers`).
  const botRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.isBot, true),
        inArray(
          users.id,
          BOT_CATALOG.map((b) => b.id),
        ),
      ),
    );
  const botIdsInDb = new Set(botRows.map((r) => r.id));
  const botsToProcess = BOT_CATALOG.filter((b) => botIdsInDb.has(b.id));

  // 2) Partidos de fase de grupos no finalizados / no live (el
  //    scoring les pillará cuando terminen).
  const matchRows = await db
    .select({
      id: matches.id,
      kickoffAt: matches.kickoffAt,
    })
    .from(matches)
    .where(and(eq(matches.stage, "group"), ne(matches.status, "finished")));

  if (matchRows.length === 0 || botsToProcess.length === 0) {
    return {
      predictionsCreated: 0,
      matchesScanned: matchRows.length,
      botsProcessed: botsToProcess.length,
    };
  }

  // 3) Para cada bot × match, generar una predicción y intentar
  //    insertarla. Usamos `ON CONFLICT DO NOTHING` con la combinación
  //    única `(user_id, match_id)`. Nota: el schema NO tiene un
  //    unique index explícito por `(user_id, match_id)`, así que
  //    tenemos que filtrar las que ya existen manualmente.
  const existingRows = await db
    .select({ userId: predictions.userId, matchId: predictions.matchId })
    .from(predictions)
    .where(
      inArray(
        predictions.userId,
        botsToProcess.map((b) => b.id),
      ),
    );
  const existingPairs = new Set(
    existingRows.map((r) => `${r.userId}:${r.matchId}`),
  );

  const now = Date.now();
  const random = Math.random;
  const toInsert: Array<typeof predictions.$inferInsert> = [];

  for (const bot of botsToProcess) {
    for (const m of matchRows) {
      const key = `${bot.id}:${m.id}`;
      if (existingPairs.has(key)) continue;

      const pred = generatePrediction(bot.style, random);
      // submittedAt en una ventana de ±30 min del momento actual.
      // Disperso pero anclado a "ahora" para que sea coherente con
      // el momento del seed.
      const jitter = Math.floor((random() * 60 - 30) * 60_000);
      const submittedAt = new Date(now + jitter);

      toInsert.push({
        userId: bot.id,
        matchId: m.id,
        kind: pred.homeScore !== null ? "exact" : "simple",
        predictedWinner: pred.outcome,
        predictedHomeScore: pred.homeScore,
        predictedAwayScore: pred.awayScore,
        submittedAt,
        // `lockedAt` se setea cuando el kickoff pasa — no lo hacemos
        // aquí, lo gestiona el pipeline de scoring igual que con
        // humanos. Si el script corre tarde y kickoff ya pasó, la
        // predicción queda con `lockedAt=null` y `processFinishedMatch`
        // la procesará correctamente como cualquier predicción válida.
      });
    }
  }

  if (toInsert.length === 0) {
    return {
      predictionsCreated: 0,
      matchesScanned: matchRows.length,
      botsProcessed: botsToProcess.length,
    };
  }

  // Inserción en batch. No usamos onConflict por las razones
  // arriba (no hay unique index); el filtro manual de existingPairs
  // garantiza idempotencia.
  await db.insert(predictions).values(toInsert);

  return {
    predictionsCreated: toInsert.length,
    matchesScanned: matchRows.length,
    botsProcessed: botsToProcess.length,
  };
}

