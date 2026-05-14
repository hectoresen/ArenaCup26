import { asc, desc, eq, sql } from "drizzle-orm";
import { dlog } from "@/lib/debug-log";
import { countryCodeToFlag } from "@/lib/format/country";
import type { Database } from "@/server/db/client";
import { userPoints, users } from "@/server/db/schema";
import type { LeaderboardSnapshot, Player } from "./types";

/**
 * 3 placeholders fijos. Decoran el ranking cuando todavía no hay
 * tráfico real, así un usuario que entre por primera vez no ve una
 * pantalla vacía. Tienen IDs estables (`seed-*`) para que el cliente
 * no los confunda con usuarios reales.
 *
 * Cuando suficientes usuarios reales superen sus puntos, los
 * placeholders caen al fondo del ranking de forma natural. Una vez
 * la app tenga ~20 usuarios reales activos, se pueden retirar.
 */
const PLACEHOLDERS: Omit<Player, "rank" | "previousRank">[] = [
  {
    id: "seed-carlos",
    name: "Carlos Mendoza",
    countryCode: "MX",
    countryName: "México",
    flag: "🇲🇽",
    points: 4820,
    streak: 7,
    correctCount: 34,
  },
  {
    id: "seed-layla",
    name: "Layla Hassan",
    countryCode: "SA",
    countryName: "Arabia Saudí",
    flag: "🇸🇦",
    points: 4610,
    streak: 5,
    correctCount: 31,
  },
  {
    id: "seed-tomas",
    name: "Tomás Reyes",
    countryCode: "AR",
    countryName: "Argentina",
    flag: "🇦🇷",
    points: 4390,
    streak: 4,
    correctCount: 29,
  },
];

/**
 * Construye un snapshot real del leaderboard. Mezcla los placeholders
 * con todos los usuarios que tengan `user_points`. Ordena por puntos
 * desc; en empate, los placeholders quedan delante (criterio: tienen
 * puntos altos por construcción).
 *
 * El cliente recibe `LeaderboardSnapshot` con el mismo shape que el
 * mock, así el componente `LeaderboardView` no requiere cambios.
 */
export async function getRealSnapshot(db: Database): Promise<LeaderboardSnapshot> {
  const realRows = await db
    .select({
      userId: userPoints.userId,
      name: users.name,
      country: users.country,
      points: userPoints.totalPoints,
      streak: userPoints.streak,
      correctCount: userPoints.correctCount,
    })
    .from(userPoints)
    .innerJoin(users, eq(users.id, userPoints.userId))
    .orderBy(desc(userPoints.totalPoints), asc(userPoints.userId));

  dlog("ranking", "getRealSnapshot", { realUsers: realRows.length });

  const realPlayers: Omit<Player, "rank" | "previousRank">[] = realRows.map((row) => ({
    id: row.userId,
    name: row.name ?? "Jugador",
    countryCode: row.country ?? "",
    countryName: row.country ?? "",
    flag: countryCodeToFlag(row.country) ?? "🌍",
    points: row.points,
    streak: row.streak,
    correctCount: row.correctCount,
  }));

  const merged = [...PLACEHOLDERS, ...realPlayers].sort((a, b) => b.points - a.points);
  const players: Player[] = merged.map((p, i) => ({
    ...p,
    rank: i + 1,
    previousRank: i + 1,
  }));

  return {
    generatedAt: new Date().toISOString(),
    players,
  };
}

/**
 * Versión que también acepta el "me" (usuario actual). Si está en la
 * lista, queda marcado por su id en el snapshot — el cliente puede
 * resaltarlo. (Para futuras mejoras del componente; hoy se usa solo
 * `getRealSnapshot` sin marca.)
 */
export async function getRealSnapshotForUser(
  db: Database,
  currentUserId: string | null,
): Promise<{ snapshot: LeaderboardSnapshot; myRank: number | null }> {
  const snapshot = await getRealSnapshot(db);
  if (!currentUserId) {
    return { snapshot, myRank: null };
  }
  // Si el user no está aún en user_points, devolvemos rank=null.
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
  // El rank "real" cuenta usuarios reales por delante + placeholders por delante.
  const placeholdersAhead = PLACEHOLDERS.filter((p) => p.points > me.total).length;
  const myRank = (aheadRows[0]?.ahead ?? 0) + placeholdersAhead + 1;
  dlog("ranking", "getRealSnapshotForUser", {
    currentUserId,
    myRank,
    points: me.total,
  });
  return { snapshot, myRank };
}
