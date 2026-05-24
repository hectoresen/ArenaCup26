import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { matches } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

export type AchievementsGateStatus = {
  /** `true` mientras finishedCount < threshold y threshold > 0. */
  active: boolean;
  /** Valor de `ACHIEVEMENTS_MIN_FINISHED_MATCHES`. `0` = sin gate. */
  threshold: number;
  finishedCount: number;
};

/**
 * Devuelve el estado actual del gate global de logros, pensado para
 * que la UI del perfil público pinte un aviso "los logros se
 * desbloquean tras N partidos".
 *
 * Cache implícito: cada call es 1 query barata sobre `matches` con
 * filtro de status — el índice cubre. No cacheamos a nivel app para
 * que cualquier `processFinishedMatch` haga visible el cambio al
 * primer refresh del user.
 */
export async function getAchievementsGateStatus(): Promise<AchievementsGateStatus> {
  const threshold = env.ACHIEVEMENTS_MIN_FINISHED_MATCHES;
  if (threshold === 0) {
    return { active: false, threshold: 0, finishedCount: 0 };
  }
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(matches)
    .where(eq(matches.status, "finished"));
  const finishedCount = rows[0]?.total ?? 0;
  return {
    active: finishedCount < threshold,
    threshold,
    finishedCount,
  };
}
