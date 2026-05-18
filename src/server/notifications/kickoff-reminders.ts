import { dlog, derr } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import {
  matches,
  notifications,
  predictions,
  teams,
  users,
} from "@/server/db/schema";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notifyWithPush } from "./notify-with-push";

/**
 * Ventana antes del kickoff dentro de la cual disparamos el recordatorio.
 * 25-35 min cubre el "30 min before" estándar con margen para crons que
 * salgan ligeramente desfasados. Con cron cada 2 min, cada match cae en
 * la ventana ~5 veces — la dedupe vía `notifications.matchId + kind` se
 * encarga de que cada user reciba el push UNA sola vez.
 */
const WINDOW_LOWER_MIN = 25;
const WINDOW_UPPER_MIN = 35;

/**
 * Solo notificamos a usuarios "activos en los últimos 30 días". Evita
 * spam a cuentas dormidas o de un solo uso. Si en el futuro queremos
 * extenderlo (e.g. cualquier user opted-in a push), ajustar este número.
 */
const ACTIVE_WINDOW_DAYS = 30;

type ReminderResult = {
  matchesProcessed: number;
  remindersSent: number;
  errors: number;
};

/**
 * Dispara recordatorios push "tu partido empieza en 30 min y no has
 * predicho" para todos los matches con kickoff dentro de la ventana
 * +25/+35 min.
 *
 * Idempotente: usa `notifications.match_id + kind='prediction_locked'`
 * como deduplicación natural. Si ya existe una notificación de ese
 * tipo para (user, match), se salta.
 *
 * Llamado desde el cron de live-scoring en cada tick. Coste BD:
 * 1 query por tick + 1 query por match en ventana + 1 query por user
 * a notificar. En la práctica son ≤4 matches en ventana, ≤20 users
 * activos sin predicción cada uno → ~5 queries por tick. Despreciable.
 */
export async function triggerKickoffReminders(
  db: Database,
  now: Date = new Date(),
): Promise<ReminderResult> {
  const lowerBound = new Date(now.getTime() + WINDOW_LOWER_MIN * 60 * 1000);
  const upperBound = new Date(now.getTime() + WINDOW_UPPER_MIN * 60 * 1000);
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86400 * 1000);

  const homeTeam = alias(teams, "home_team_kickoff");
  const awayTeam = alias(teams, "away_team_kickoff");

  const upcomingRows = await db
    .select({
      id: matches.id,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
    })
    .from(matches)
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(
      and(
        inArray(matches.status, ["scheduled", "prediction-locked"]),
        gte(matches.kickoffAt, lowerBound),
        lte(matches.kickoffAt, upperBound),
      ),
    );

  let remindersSent = 0;
  let errors = 0;

  for (const match of upcomingRows) {
    // Users activos en los últimos N días, sin predicción para este match,
    // y sin notificación `prediction_locked` previa para este match.
    const usersToNotify = await db
      .select({ userId: users.id })
      .from(users)
      .where(
        and(
          sql`${users.lastActiveAt} IS NOT NULL AND ${users.lastActiveAt} >= ${activeSince}`,
          sql`NOT EXISTS (
            SELECT 1 FROM ${predictions}
            WHERE ${predictions.userId} = ${users.id}
              AND ${predictions.matchId} = ${match.id}
          )`,
          sql`NOT EXISTS (
            SELECT 1 FROM ${notifications}
            WHERE ${notifications.userId} = ${users.id}
              AND ${notifications.matchId} = ${match.id}
              AND ${notifications.kind} = 'prediction_locked'
          )`,
        ),
      );

    const matchup =
      match.homeName && match.awayName ? `${match.homeName} vs ${match.awayName}` : "Tu partido";

    for (const u of usersToNotify) {
      try {
        await notifyWithPush({
          db,
          userId: u.userId,
          kind: "prediction_locked",
          title: `Empieza en 30 min: ${matchup}`,
          body: "Aún no has predicho. ¡Vas a tiempo!",
          matchId: match.id,
          pushable: true,
        });
        remindersSent++;
      } catch (err) {
        errors++;
        derr("push", "kickoff reminder failed", {
          userId: u.userId,
          matchId: match.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  if (upcomingRows.length > 0 || remindersSent > 0) {
    dlog("push", "kickoff reminders processed", {
      matchesProcessed: upcomingRows.length,
      remindersSent,
      errors,
    });
  }

  return {
    matchesProcessed: upcomingRows.length,
    remindersSent,
    errors,
  };
}
