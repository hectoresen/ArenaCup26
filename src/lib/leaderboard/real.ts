import { asc, desc, eq, sql } from "drizzle-orm";
import { dlog } from "@/lib/debug-log";
import { countryCodeToFlag } from "@/lib/format/country";
import type { Database } from "@/server/db/client";
import { userPoints, users } from "@/server/db/schema";
import type { LeaderboardSnapshot, Player } from "./types";

/**
 * Construye un snapshot del leaderboard a partir de `user_points` +
 * `users`. Devuelve los usuarios ordenados por puntos desc.
 *
 * Los 3 usuarios "placeholder" (Carlos / Layla / Tomás) se siembran
 * desde `scripts/bootstrap.ts` (ver `seedLeaderboardPlaceholders`)
 * como filas reales en BD, así que aparecen aquí sin lógica especial
 * y son clicables a `/u/<username>`.
 */
export async function getRealSnapshot(db: Database): Promise<LeaderboardSnapshot> {
  const rows = await db
    .select({
      userId: userPoints.userId,
      username: users.username,
      name: users.name,
      country: users.country,
      points: userPoints.totalPoints,
      streak: userPoints.streak,
      correctCount: userPoints.correctCount,
    })
    .from(userPoints)
    .innerJoin(users, eq(users.id, userPoints.userId))
    .orderBy(desc(userPoints.totalPoints), asc(userPoints.userId));

  dlog("ranking", "getRealSnapshot", { users: rows.length });

  const players: Player[] = rows.map((row, i) => ({
    id: row.userId,
    username: row.username,
    name: row.name ?? "Jugador",
    countryCode: row.country ?? "",
    countryName: row.country ?? "",
    flag: countryCodeToFlag(row.country) ?? "🌍",
    points: row.points,
    streak: row.streak,
    correctCount: row.correctCount,
    rank: i + 1,
    previousRank: i + 1,
  }));

  return {
    generatedAt: new Date().toISOString(),
    players,
  };
}

/**
 * Versión que también devuelve la posición del usuario actual.
 * (Pendiente de uso desde el UI — útil cuando aterrice la fila "Tu
 * posición" sticky en el ranking grande.)
 */
export async function getRealSnapshotForUser(
  db: Database,
  currentUserId: string | null,
): Promise<{ snapshot: LeaderboardSnapshot; myRank: number | null }> {
  const snapshot = await getRealSnapshot(db);
  if (!currentUserId) {
    return { snapshot, myRank: null };
  }
  const row = await db
    .select({ total: userPoints.totalPoints })
    .from(userPoints)
    .where(eq(userPoints.userId, currentUserId))
    .limit(1);
  const me = row[0];
  if (!me) {
    return { snapshot, myRank: null };
  }
  const aheadRows = await db
    .select({ ahead: sql<number>`count(*)::int` })
    .from(userPoints)
    .where(sql`${userPoints.totalPoints} > ${me.total}`);
  const myRank = (aheadRows[0]?.ahead ?? 0) + 1;
  dlog("ranking", "getRealSnapshotForUser", {
    currentUserId,
    myRank,
    points: me.total,
  });
  return { snapshot, myRank };
}
