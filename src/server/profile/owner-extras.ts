import { dlog } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import { pointEvents, userPoints, users } from "@/server/db/schema";
import { getPredictionHistory } from "@/server/history/queries";
import type { HistoryEntry } from "@/server/history/types";
import { countRedeemedInvitations } from "@/server/invitations/queries";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";

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

export type OwnerCooldowns = {
  /**
   * Milisegundos restantes antes de poder cambiar el nombre otra vez.
   * 0 si ya pasó el cooldown (o nunca se ha cambiado).
   */
  nameCooldownRemainingMs: number;
  /** Idem para el avatar. */
  avatarCooldownRemainingMs: number;
};

export type OwnerExtras = {
  streakStats: OwnerStreakStats;
  recentPredictions: HistoryEntry[];
  invitationsCount: number;
  cooldowns: OwnerCooldowns;
};

const COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Carga las cajas extra que solo se muestran cuando el viewer es
 * el dueño del perfil. Las queries son baratas y se hacen en
 * paralelo. No se ejecutan para visitantes anónimos.
 *
 * `invitationsCount` cuenta cuántos users han redimido un link de
 * invitación creado por este usuario (sistema F4 — `add-invitations`,
 * 2026-05-16).
 */
export async function getOwnerExtras(db: Database, userId: string): Promise<OwnerExtras> {
  const [pointsRow, comboCount, recent, invitationsTotal, userRow] = await Promise.all([
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
    getPredictionHistory(db, userId, { limit: 5 }),
    countRedeemedInvitations(db, userId),
    db
      .select({
        nameChangedAt: users.nameChangedAt,
        avatarChangedAt: users.avatarChangedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  const streakStats: OwnerStreakStats = {
    current: pointsRow[0]?.current ?? 0,
    max: pointsRow[0]?.max ?? 0,
    milestoneCount: Number(comboCount[0]?.total ?? 0),
  };

  const now = Date.now();
  const cooldowns: OwnerCooldowns = {
    nameCooldownRemainingMs: cooldownRemaining(userRow[0]?.nameChangedAt ?? null, now),
    avatarCooldownRemainingMs: cooldownRemaining(userRow[0]?.avatarChangedAt ?? null, now),
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
    cooldowns,
  };
}

/**
 * Devuelve milisegundos restantes hasta que el cooldown expire. 0 si
 * `lastChange` es null o ya pasó 1h.
 */
function cooldownRemaining(lastChange: Date | null, now: number): number {
  if (!lastChange) return 0;
  const elapsed = now - lastChange.getTime();
  return Math.max(0, COOLDOWN_MS - elapsed);
}
