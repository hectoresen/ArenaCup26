import { asc, desc, eq, sql } from "drizzle-orm";
import { dlog } from "@/lib/debug-log";
import { countryCodeToFlag } from "@/lib/format/country";
import type { Database } from "@/server/db/client";
import { userPoints, users } from "@/server/db/schema";
import type { LeaderboardSnapshot, Player } from "./types";

const TOP_LIMIT = 100;

/**
 * Construye un snapshot del leaderboard listando **todos los users**
 * registrados (ordenados por puntos desc, tope `TOP_LIMIT` = 100).
 *
 * - LEFT JOIN a `user_points`: un user sin fila en `user_points`
 *   (todavía no ha puntuado) aparece con 0 al final de la lista.
 *   Cuando reciba puntos, sube automáticamente. Sin esto, los nuevos
 *   registrados estaban invisibles hasta su primer acierto.
 * - Los 7 usuarios placeholder se siembran como filas reales en
 *   `users` + `user_points` desde `scripts/bootstrap.ts`.
 * - Tie-break por `createdAt` ascendente: usuarios más antiguos
 *   delante en empate de puntos.
 * - `previousRank` queda igual a `rank` hasta `add-ranking-history`.
 */
export async function getRealSnapshot(db: Database): Promise<LeaderboardSnapshot> {
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      name: users.name,
      country: users.country,
      points: userPoints.totalPoints,
      streak: userPoints.streak,
      correctCount: userPoints.correctCount,
    })
    .from(users)
    .leftJoin(userPoints, eq(userPoints.userId, users.id))
    .orderBy(desc(sql`coalesce(${userPoints.totalPoints}, 0)`), asc(users.createdAt))
    .limit(TOP_LIMIT);

  dlog("ranking", "getRealSnapshot", { users: rows.length });

  const players: Player[] = rows.map((row, i) => ({
    id: row.userId,
    username: row.username,
    name: row.name ?? "Jugador",
    countryCode: row.country ?? "",
    countryName: row.country ?? "",
    flag: countryCodeToFlag(row.country) ?? "🌍",
    points: row.points ?? 0,
    streak: row.streak ?? 0,
    correctCount: row.correctCount ?? 0,
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
 * Igual que `getRealSnapshot` + un cálculo extra del rank del user.
 *
 * El rank se calcula contando users con puntos estrictamente mayores
 * (coalesce a 0 para el comparable), igual que el orden del snapshot.
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
  const myPoints = row[0]?.total ?? 0;
  const aheadRows = await db
    .select({ ahead: sql<number>`count(*)::int` })
    .from(users)
    .leftJoin(userPoints, eq(userPoints.userId, users.id))
    .where(sql`coalesce(${userPoints.totalPoints}, 0) > ${myPoints}`);
  const myRank = (aheadRows[0]?.ahead ?? 0) + 1;
  dlog("ranking", "getRealSnapshotForUser", {
    currentUserId,
    myRank,
    points: myPoints,
  });
  return { snapshot, myRank };
}
