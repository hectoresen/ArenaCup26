import { dlog, derr } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { matches, userPoints } from "@/server/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const SEED_PLACEHOLDER_PREFIX = "00000000-0000-4000-a000-";

/**
 * Endpoint admin TEMPORAL para reset destructivo de la BD de partidos
 * durante QA. Misma autenticación que los crons (Bearer CRON_SECRET).
 *
 * Lo que hace:
 *   1. DELETE FROM matches  (cascade a predictions + point_events)
 *   2. UPDATE user_points → 0 para usuarios reales
 *      (placeholders se preservan, son canónicos vía bootstrap)
 *
 * **A BORRAR** una vez completado el reset de QA. No debería quedar
 * un endpoint con esta capacidad en producción más allá del tiempo
 * estrictamente necesario para una operación puntual.
 */
export async function POST(req: Request) {
  const expected = env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!expected || header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    dlog("cron", "reset-matches: starting wipe");

    await db.delete(matches);
    dlog("cron", "reset-matches: matches table cleared (cascade applied)");

    await db
      .update(userPoints)
      .set({
        totalPoints: 0,
        streak: 0,
        streakMax: 0,
        correctCount: 0,
        simpleHits: 0,
      })
      .where(sql`${userPoints.userId}::text NOT LIKE ${SEED_PLACEHOLDER_PREFIX + "%"}`);
    dlog("cron", "reset-matches: user_points reset for real users");

    return NextResponse.json({
      ok: true,
      message: "Matches wiped + real user_points reset. Seeds preserved.",
      nextSteps: [
        "Trigger match-data-sync workflow in GitHub Actions to repopulate.",
      ],
    });
  } catch (err) {
    derr("cron", "reset-matches failed", err);
    return NextResponse.json(
      { error: "internal_error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
