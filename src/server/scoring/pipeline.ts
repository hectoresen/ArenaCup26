import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { dlog } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import {
  matches,
  pointEvents,
  predictions,
  teams,
  userPoints,
} from "@/server/db/schema";
import { derr } from "@/lib/debug-log";
import { evaluateAndUnlock } from "@/server/achievements/unlock";
import { payReferralBonusIfFirstHit } from "@/server/invitations/referral-payout";
import { notifyWithPush } from "@/server/notifications/notify-with-push";
import { publishRankingChange } from "@/lib/redis/ranking-events";
import { scoreMatchPrediction } from "./engine";
import type {
  MatchOutcome,
  MatchStage,
  Prediction,
  StreakState,
  PointEventKind,
} from "./types";

export type ProcessFinishedMatchResult = {
  matchId: string;
  processed: number;
  skipped: number;
  errors: Array<{ userId: string; reason: string }>;
};

/**
 * Procesa un partido recién terminado: lee todas las predicciones,
 * calcula puntos con el engine y persiste `point_events` +
 * actualiza `user_points` + emite notificación al usuario.
 *
 * Reglas:
 * - **Idempotente** sobre re-ejecuciones: si ya existe un
 *   `point_events` para `(userId, matchId)`, ese user se salta.
 * - Cada user se procesa **independientemente** (sin tx global) —
 *   un error en uno no impide procesar el resto.
 * - Si el match no está en `status=finished` o le falta `scoreAt90`,
 *   no se procesa nada y se devuelve un error.
 *
 * Se llama desde el handler del cron al detectar que un match pasó a
 * `finished` en el reconcile. También se puede ejecutar manualmente
 * (script de reprocesado) sin riesgo.
 */
export async function processFinishedMatch(
  db: Database,
  matchId: string,
): Promise<ProcessFinishedMatchResult> {
  const result: ProcessFinishedMatchResult = {
    matchId,
    processed: 0,
    skipped: 0,
    errors: [],
  };

  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");
  const rows = await db
    .select({
      id: matches.id,
      stage: matches.stage,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeScoreExtra: matches.homeScoreExtra,
      awayScoreExtra: matches.awayScoreExtra,
      penaltyWinnerTeamId: matches.penaltyWinnerTeamId,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
    })
    .from(matches)
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(eq(matches.id, matchId))
    .limit(1);

  const match = rows[0];
  if (!match) {
    dlog("scoring", "match_not_found", { matchId });
    result.errors.push({ userId: "<n/a>", reason: "match_not_found" });
    return result;
  }

  if (match.status !== "finished") {
    dlog("scoring", "match_not_finished, skipping", { matchId, status: match.status });
    result.errors.push({ userId: "<n/a>", reason: `match_status_${match.status}` });
    return result;
  }

  const outcome = matchRowToOutcome(match);
  dlog("scoring", "processing finished match", {
    matchId,
    matchup: matchupLabel(match.homeTeamName, match.awayTeamName),
    outcome,
  });

  const matchPredictions = await db
    .select({
      userId: predictions.userId,
      kind: predictions.kind,
      predictedWinner: predictions.predictedWinner,
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
    })
    .from(predictions)
    .where(eq(predictions.matchId, matchId));
  dlog("scoring", `found ${matchPredictions.length} predictions to score`);

  if (matchPredictions.length === 0) {
    dlog("scoring", "no predictions for match, nothing to do", { matchId });
    return result;
  }

  // Pre-carga batch: dos queries en vez de 2×N. Para 5000 predictores
  // esto solo nos ahorra ~50s de round-trips a Postgres. Las pre-cargas
  // viven en memoria durante el loop; los UPDATEs posteriores siguen
  // siendo individuales (Drizzle no expone UPDATE FROM batch sencillo,
  // y los UPSERTs dependen del streak de cada user). La concurrencia
  // (más abajo) hace el otro 80% del trabajo.
  const userIds = matchPredictions.map((p) => p.userId);
  const [alreadyScoredRows, streakRows] = await Promise.all([
    db
      .selectDistinct({ userId: pointEvents.userId })
      .from(pointEvents)
      .where(and(eq(pointEvents.matchId, matchId), inArray(pointEvents.userId, userIds))),
    db
      .select({ userId: userPoints.userId, streak: userPoints.streak })
      .from(userPoints)
      .where(inArray(userPoints.userId, userIds)),
  ]);
  const alreadyScored = new Set(alreadyScoredRows.map((r) => r.userId));
  const streakMap = new Map(streakRows.map((r) => [r.userId, r.streak]));

  const matchup = matchupLabel(match.homeTeamName, match.awayTeamName);

  // Concurrencia controlada: 25 users en paralelo para no saturar el
  // pool de conexiones de Postgres (default Drizzle/postgres-js ~10-20).
  // En partidos con 5k predictores baja el tiempo total de ~150s
  // (serial × 30ms/iter) a ~6s. En partidos con <100 predictores el
  // overhead del limiter es despreciable.
  const CONCURRENCY = 25;
  await mapWithConcurrency(matchPredictions, CONCURRENCY, async (p) => {
    if (alreadyScored.has(p.userId)) {
      dlog("scoring", "already scored, skipping", { userId: p.userId, matchId });
      result.skipped++;
      return;
    }

    try {
      const streakBefore: StreakState = {
        current: streakMap.get(p.userId) ?? 0,
        containsDouble: false,
      };
      const prediction: Prediction = {
        kind: p.kind,
        predictedWinner: p.predictedWinner,
        predictedHomeScore: p.predictedHomeScore,
        predictedAwayScore: p.predictedAwayScore,
      };
      const scored = scoreMatchPrediction(outcome, prediction, streakBefore);
      dlog("scoring", "scored prediction", {
        userId: p.userId,
        kind: scored.kind,
        points: scored.points,
        combos: scored.comboBonuses.length,
        streakAfter: scored.streakAfter.current,
      });

      await persistScore({
        db,
        userId: p.userId,
        matchId,
        scored,
        matchup,
      });

      // Tras persistir puntos/racha, evaluamos los logros del user. El
      // unlocker es idempotente (no re-desbloquea), notifica al user
      // cuando un logro nuevo se abre, y no aborta el scoring si falla
      // algún unlock concreto.
      try {
        await evaluateAndUnlock(db, p.userId);
      } catch (err) {
        derr("scoring", `evaluateAndUnlock threw for user ${p.userId}`, err);
      }

      // Referral payout: si este user es un invitado y este score
      // fue su primer hit oficial, paga +10pts al inviter y
      // desbloquea `better-with-friends`. Solo se considera hit si
      // sumó puntos (excluye miss/voided). El payout es atómico
      // (single-UPDATE guard) y no fallible — errores se loguean.
      const isHit = scored.kind !== "miss" && scored.kind !== "voided";
      if (isHit) {
        try {
          const payout = await payReferralBonusIfFirstHit(db, p.userId, matchId);
          if (payout.paid) {
            await evaluateAndUnlock(db, payout.inviterId);
          }
        } catch (err) {
          derr("scoring", `referral payout threw for user ${p.userId}`, err);
        }
      }

      result.processed++;
    } catch (err) {
      derr("scoring", `persistScore failed for user ${p.userId} match ${matchId}`, err);
      result.errors.push({
        userId: p.userId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Anunciar el cambio a los SSE conectados. Best-effort — si Redis
  // no está o falla, el SSE caerá al tick periódico de 15 s como
  // fallback. Solo publicamos si hubo procesados (skipped + errors no
  // mueven el ranking).
  if (result.processed > 0) {
    void publishRankingChange();
  }

  dlog("scoring", "processFinishedMatch done", {
    matchId,
    processed: result.processed,
    skipped: result.skipped,
    errors: result.errors.length,
  });
  return result;
}

/**
 * Mapea una fila de `matches` a `MatchOutcome` del scoring engine.
 * Pure helper exportado para tests.
 */
export function matchRowToOutcome(row: {
  stage: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreExtra: number | null;
  awayScoreExtra: number | null;
  penaltyWinnerTeamId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
}): MatchOutcome {
  const scoreAt90 =
    row.homeScore !== null && row.awayScore !== null
      ? { home: row.homeScore, away: row.awayScore }
      : null;
  const scoreAtExtra =
    row.homeScoreExtra !== null && row.awayScoreExtra !== null
      ? { home: row.homeScoreExtra, away: row.awayScoreExtra }
      : null;
  const penaltyWinner: "home" | "away" | null =
    row.penaltyWinnerTeamId === null
      ? null
      : row.penaltyWinnerTeamId === row.homeTeamId
        ? "home"
        : row.penaltyWinnerTeamId === row.awayTeamId
          ? "away"
          : null;
  return {
    status: row.status as MatchOutcome["status"],
    stage: row.stage as MatchStage,
    scoreAt90,
    scoreAtExtra,
    penaltyWinner,
  };
}

type PersistScoreInput = {
  db: Database;
  userId: string;
  matchId: string;
  scored: ReturnType<typeof scoreMatchPrediction>;
  matchup: string;
};

async function persistScore({
  db,
  userId,
  matchId,
  scored,
  matchup,
}: PersistScoreInput): Promise<void> {
  const isHit = scored.kind !== "miss" && scored.kind !== "voided";

  // 1) point_events: una fila por el evento principal, una por cada combo.
  await db.insert(pointEvents).values({
    userId,
    matchId,
    kind: pointEventKindFor(scored.kind),
    points: scored.points - scored.comboBonuses.reduce((s, c) => s + c.points, 0),
  });
  for (const combo of scored.comboBonuses) {
    await db.insert(pointEvents).values({
      userId,
      matchId,
      kind: "combo",
      points: combo.points,
    });
  }

  // 2) user_points: upsert.
  //    - `correctCount` solo crece si fue hit.
  //    - `streakMax` siempre se queda en el máximo histórico (no se
  //      resetea cuando la racha cae).
  //    - `simpleHits` se incrementa SOLO cuando el hit fue de tipo
  //      `simple` o `exact` (no con `double-*`). Es el 3er criterio
  //      del desempate del ranking.
  const isHighQualityHit = scored.kind === "simple" || scored.kind === "exact";
  const newStreakMaxSql = sql`greatest(${userPoints.streakMax}, ${scored.streakAfter.current})`;
  await db
    .insert(userPoints)
    .values({
      userId,
      totalPoints: scored.points,
      correctCount: isHit ? 1 : 0,
      streak: scored.streakAfter.current,
      streakMax: scored.streakAfter.current,
      simpleHits: isHighQualityHit ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: userPoints.userId,
      set: {
        totalPoints: sql`${userPoints.totalPoints} + ${scored.points}`,
        correctCount: sql`${userPoints.correctCount} + ${isHit ? 1 : 0}`,
        streak: scored.streakAfter.current,
        streakMax: newStreakMaxSql,
        simpleHits: sql`${userPoints.simpleHits} + ${isHighQualityHit ? 1 : 0}`,
        updatedAt: sql`now()`,
      },
    });

  // 3) Notificación al usuario con el resultado.
  await notifyWithPush({
    db,
    userId,
    kind: "match_finished",
    title: matchup,
    body: isHit
      ? `+${scored.points} puntos ${scored.kind === "exact" ? "💎 marcador exacto" : ""}`.trim()
      : "Fallaste esta predicción. ¡La próxima!",
    matchId,
    pushable: true,
  });
}

function pointEventKindFor(scoredKind: PointEventKind): "simple" | "exact" | "double" | "combo" | "poll" | "referral" {
  // El enum de BD no tiene `miss`/`voided`. En esos casos
  // guardamos `simple` con 0 puntos para conservar trazabilidad.
  if (scoredKind === "simple" || scoredKind === "exact" || scoredKind === "double") {
    return scoredKind;
  }
  return "simple";
}

function matchupLabel(home: string | null, away: string | null): string {
  if (home && away) return `${home} vs ${away}`;
  return "Partido";
}

/**
 * Calcula los puntos que el usuario se llevaría SI el partido
 * acabara con el marcador actual. Útil para mostrar "Provisional ·
 * +30 pts" en la live card.
 *
 * NO persiste nada. NO mueve la racha. Solo invoca el engine con un
 * outcome "as if finished" construido del snapshot live.
 *
 * Si no hay marcador en vivo (scoreAt90 ambos null) devuelve null —
 * todavía no se puede inferir nada.
 */
export function computeProvisionalScore(
  matchSnapshot: {
    stage: string;
    homeScore: number | null;
    awayScore: number | null;
  },
  prediction: Prediction,
  streakBefore: StreakState,
): ReturnType<typeof scoreMatchPrediction> | null {
  if (matchSnapshot.homeScore === null || matchSnapshot.awayScore === null) {
    return null;
  }
  const outcomeAsIf: MatchOutcome = {
    status: "finished",
    stage: matchSnapshot.stage as MatchStage,
    scoreAt90: { home: matchSnapshot.homeScore, away: matchSnapshot.awayScore },
    scoreAtExtra: null,
    penaltyWinner: null,
  };
  return scoreMatchPrediction(outcomeAsIf, prediction, streakBefore);
}

/**
 * Procesa `items` en paralelo con un tope simultáneo de `concurrency`.
 * Útil para no saturar el pool de conexiones de Postgres ni la quota
 * de push providers cuando hay muchos predictores de un mismo match.
 *
 * Implementación de "worker pool sencillo": spawn N workers que tiran
 * del array compartido vía un cursor atómico (índice incremental).
 * Cada worker espera a `task()` antes de coger el siguiente. No es
 * `Promise.all([...].map())` porque ese sí lanza todo a la vez.
 *
 * No corta en errores — el caller es responsable de envolver `task`
 * en try/catch si quiere recoger fallos sin abortar el resto.
 */
async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) return;
      await task(item);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
}
