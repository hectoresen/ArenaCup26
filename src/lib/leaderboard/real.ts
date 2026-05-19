import { asc, desc, eq, sql } from "drizzle-orm";
import { dlog } from "@/lib/debug-log";
import { countryCodeToFlag } from "@/lib/format/country";
import type { Database } from "@/server/db/client";
import { predictions, userPoints, users } from "@/server/db/schema";
import type { LeaderboardSnapshot, Player } from "./types";

const TOP_LIMIT = 100;

/**
 * Threshold para considerar un user "online" en el ranking. Si su
 * `last_active_at` está dentro de este margen, mostramos el puntito
 * verde. 24h es la regla acordada (docs/roadmap.md §1.1).
 */
const ONLINE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Construye un snapshot del leaderboard listando **todos los users**
 * registrados (ordenados por puntos desc, tope `TOP_LIMIT` = 100).
 *
 * El ranking es **inamovible**: independientemente del `privacy.visibility`
 * del user, su información básica (nombre, bandera, puntos, avatar)
 * siempre aparece aquí. La privacy solo afecta a la página
 * `/u/<username>`, no al ranking global — la posición y los puntos
 * son información pública del juego.
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
  // Subselect: count de predictions por user, para tie-break por
  // participación (4º criterio del desempate).
  const predictionCountSubq = db
    .select({
      userId: predictions.userId,
      total: sql<number>`count(*)::int`.as("pred_total"),
    })
    .from(predictions)
    .groupBy(predictions.userId)
    .as("pred_counts");

  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      name: users.name,
      country: users.country,
      lastActiveAt: users.lastActiveAt,
      avatarId: users.avatarId,
      image: users.image,
      points: userPoints.totalPoints,
      streak: userPoints.streak,
      streakMax: userPoints.streakMax,
      simpleHits: userPoints.simpleHits,
      correctCount: userPoints.correctCount,
      predictionsTotal: predictionCountSubq.total,
    })
    .from(users)
    .leftJoin(userPoints, eq(userPoints.userId, users.id))
    .leftJoin(predictionCountSubq, eq(predictionCountSubq.userId, users.id))
    // Tie-break: points → streakMax → simpleHits → predictionsTotal
    //          → createdAt. Documentado en docs/scoring.md §X.
    .orderBy(
      desc(sql`coalesce(${userPoints.totalPoints}, 0)`),
      desc(sql`coalesce(${userPoints.streakMax}, 0)`),
      desc(sql`coalesce(${userPoints.simpleHits}, 0)`),
      desc(sql`coalesce(${predictionCountSubq.total}, 0)`),
      asc(users.createdAt),
    )
    .limit(TOP_LIMIT);

  dlog("ranking", "getRealSnapshot", { users: rows.length });

  const now = Date.now();
  const players: Player[] = rows.map((row, i) => {
    const isOnline = row.lastActiveAt
      ? now - row.lastActiveAt.getTime() <= ONLINE_WINDOW_MS
      : false;
    // Username siempre se entrega: la fila del ranking siempre lleva
    // a `/u/<username>`. Si el owner tiene `private` o `friends_only`
    // (sin amigos todavía), esa página renderiza el cartel "Perfil
    // privado" en lugar del perfil completo.
    return {
      id: row.userId,
      username: row.username,
      name: row.name?.trim() || "Jugador",
      countryCode: row.country ?? "",
      countryName: row.country ?? "",
      flag: countryCodeToFlag(row.country) ?? "🌍",
      points: row.points ?? 0,
      streak: row.streak ?? 0,
      correctCount: row.correctCount ?? 0,
      rank: i + 1,
      previousRank: i + 1,
      isOnline,
      avatarId: row.avatarId,
      image: row.image,
    };
  });

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
