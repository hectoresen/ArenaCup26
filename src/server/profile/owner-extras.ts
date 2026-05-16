import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { dlog } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import { pointEvents, userPoints } from "@/server/db/schema";
import { getPredictionHistory } from "@/server/history/queries";
import type { HistoryEntry } from "@/server/history/types";
import { countRedeemedInvitations } from "@/server/invitations/queries";

export type OwnerStreakStats = {
  /** Racha activa ahora mismo. 0 si no hay racha. */
  current: number;
  /** Mayor racha histórica del user (`user_points.streak_max`). */
  max: number;
  /**
   * Cuántas veces ha llegado el user al umbral de "estar en racha"
   * (>=3 aciertos seguidos). Counter aproximado: contamos los
   * `point_events` con `kind = "combo"` (que se insertan cuando se
   * dispara un milestone 3/5/10). Si más adelante queremos un
   * contador más fiel, lo derivamos de un counter dedicado.
   */
  milestoneCount: number;
};

export type OwnerExtras = {
  streakStats: OwnerStreakStats;
  recentPredictions: HistoryEntry[];
  invitationsCount: number;
};

/**
 * Carga las cajas extra que solo se muestran cuando el viewer es
 * el dueño del perfil. Las queries son baratas y se hacen en
 * paralelo. No se ejecutan para visitantes anónimos.
 *
 * `invitationsCount` cuenta cuántos users han redimido un link de
 * invitación creado por este usuario (sistema F4 — `add-invitations`,
 * 2026-05-16).
 */
export async function getOwnerExtras(
  db: Database,
  userId: string,
): Promise<OwnerExtras> {
  const [pointsRow, comboCount, recent, invitationsTotal] = await Promise.all([
    db
      .select({
        current: userPoints.streak,
        max: userPoints.streakMax,
      })
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1),
    db
      .select({ total: count() })
      .from(pointEvents)
      .where(and(eq(pointEvents.userId, userId), eq(pointEvents.kind, "combo"))),
    getPredictionHistory(db, userId, 5),
    countRedeemedInvitations(db, userId),
  ]);

  const streakStats: OwnerStreakStats = {
    current: pointsRow[0]?.current ?? 0,
    max: pointsRow[0]?.max ?? 0,
    milestoneCount: Number(comboCount[0]?.total ?? 0),
  };

  dlog("ranking", "getOwnerExtras", {
    userId,
    streakStats,
    recent: recent.length,
    invitations: invitationsTotal,
  });

  return {
    streakStats,
    recentPredictions: recent,
    invitationsCount: invitationsTotal,
  };
}
