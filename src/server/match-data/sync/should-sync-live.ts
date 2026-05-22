import type { Database } from "@/server/db/client";
import { matches } from "@/server/db/schema";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

/**
 * Ventana antes de kickoff durante la cual ya consideramos "live"
 * para refrescar. 15 minutos cubre las transiciones `scheduled` →
 * `prediction-locked` → `live` cerca del pitido inicial.
 */
const KICKOFF_WINDOW_MIN = 15;

/**
 * Ventana después de un kickoff durante la cual seguimos refrescando
 * aunque el provider todavía no haya movido el match a `live` (delay
 * típico de api-football: 1-2 min para arrancar el live tracking).
 * Más generoso (30 min) que la pre-kickoff window.
 */
const POST_KICKOFF_WINDOW_MIN = 30;

export type ShouldSyncLiveResult =
  | {
      sync: true;
      reason: "live_in_progress" | "kickoff_imminent" | "recent_kickoff";
      sample: string;
    }
  | { sync: false };

/**
 * Decide si el cron de live-scoring debe llamar al sync ahora o
 * puede saltarse esta ejecución. Tres motivos para sincronizar:
 *
 *  1. Hay partidos con `status = 'live'` en BD → refrescar marcadores.
 *  2. Hay un kickoff en los próximos 15 min → permitir transición
 *     scheduled → live cerca del pitido inicial.
 *  3. Hay un kickoff en los últimos 30 min → el provider todavía
 *     puede no haber marcado `live`, sigamos refrescando.
 *
 * Si ninguno aplica, devolvemos `{ sync: false }` para que el cron
 * salga con 204 sin gastar requests a api-football.
 */
export async function shouldSyncLive(
  db: Database,
  now: Date = new Date(),
): Promise<ShouldSyncLiveResult> {
  // Caso 1: partidos en vivo.
  const liveRows = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.status, "live"))
    .limit(1);
  if (liveRows.length > 0) {
    return { sync: true, reason: "live_in_progress", sample: liveRows[0]?.id ?? "" };
  }

  // Caso 2 + 3: ventana ±N min alrededor de kickoffs scheduled.
  // PostgreSQL maneja la comparación de timestamp con offset directamente.
  const upperBound = new Date(now.getTime() + KICKOFF_WINDOW_MIN * 60 * 1000);
  const lowerBound = new Date(now.getTime() - POST_KICKOFF_WINDOW_MIN * 60 * 1000);

  const upcomingRows = await db
    .select({ id: matches.id, kickoffAt: matches.kickoffAt })
    .from(matches)
    .where(
      and(
        inArray(matches.status, ["scheduled", "prediction-locked"]),
        gte(matches.kickoffAt, lowerBound),
        lte(matches.kickoffAt, upperBound),
      ),
    )
    .orderBy(asc(matches.kickoffAt))
    .limit(1);

  if (upcomingRows.length > 0) {
    const row = upcomingRows[0];
    if (row) {
      const reason: ShouldSyncLiveResult & { sync: true } = {
        sync: true,
        reason: row.kickoffAt.getTime() >= now.getTime() ? "kickoff_imminent" : "recent_kickoff",
        sample: row.id,
      };
      return reason;
    }
  }

  return { sync: false };
}
