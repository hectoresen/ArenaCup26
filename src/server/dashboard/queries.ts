import { countryCodeToFlag } from "@/lib/format/country";
import type { Database } from "@/server/db/client";
import {
  achievementDefinitions,
  friendships,
  matches,
  predictions,
  teams,
  userAchievements,
  userPoints,
  users,
} from "@/server/db/schema";
import { getRankHistory } from "@/server/ranking-history/queries";
import { computeProvisionalScore } from "@/server/scoring/pipeline";
import type { MatchStage } from "@/server/scoring/types";
import { and, asc, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { UPCOMING_LIMIT, buildMiniLeaderboard, sortUpcomingMatches } from "./transforms";
import type {
  DashboardData,
  FriendsMiniLeaderboardView,
  LeaderboardEntry,
  LiveMatchView,
  MiniLeaderboardData,
  MiniLeaderboardView,
  PredictionView,
  Progress,
  TeamView,
  UpcomingHeroView,
  UpcomingMatch,
  UserStats,
} from "./types";

/**
 * Entrada única del dashboard. Paraleliza todas las queries y monta el
 * `DashboardData` que la página `/inicio` recibe directamente.
 *
 * Cada sub-query es responsabilidad de su propia función exportada
 * (testeable en aislamiento contra DB real). El orquestador solo hace
 * `Promise.all` y composición.
 */
export async function getDashboardData(db: Database, userId: string): Promise<DashboardData> {
  const userRow = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const userName = userRow[0]?.name ?? "";

  const [stats, live, upcomingRaw, progress, miniGlobal, miniFriends, achievementsTotal] =
    await Promise.all([
      getUserStats(db, userId),
      getLiveMatchForUser(db, userId),
      getUpcomingMatches(db, userId, UPCOMING_LIMIT * 2),
      getProgress(db, userId),
      getMiniLeaderboard(db, userId, 5),
      getFriendsMiniLeaderboard(db, userId, 5),
      countAchievementDefinitions(db),
    ]);
  const mini: MiniLeaderboardData = { global: miniGlobal, friends: miniFriends };

  const sortedAll = sortUpcomingMatches(upcomingRaw);

  // Si no hay live, el primer próximo se promueve a "hero card".
  const nextSource = sortedAll[0];
  const nextMatch: UpcomingHeroView | null =
    live === null && nextSource && nextSource.homeTeam && nextSource.awayTeam
      ? {
          matchId: nextSource.matchId,
          stage: nextSource.stage,
          kickoffAt: nextSource.kickoffAt,
          homeTeam: nextSource.homeTeam,
          awayTeam: nextSource.awayTeam,
          prediction: nextSource.prediction,
        }
      : null;

  // El match que ocupa la "hero card" no se duplica en la lista de
  // próximos. La lista mantiene su tamaño (UPCOMING_LIMIT) excluyendo
  // ese matchId — pedimos algunos extra arriba para no quedarnos
  // cortos cuando excluimos.
  const upcoming = sortedAll
    .filter((m) => m.matchId !== nextMatch?.matchId)
    .slice(0, UPCOMING_LIMIT);

  return {
    userName,
    stats: { ...stats, achievementsTotal },
    live,
    nextMatch,
    upcoming,
    progress,
    mini,
  };
}

// ─── Sub-queries ──────────────────────────────────────────────

export async function getUserStats(
  db: Database,
  userId: string,
): Promise<Omit<UserStats, "achievementsTotal">> {
  const rows = await db
    .select({
      totalPoints: userPoints.totalPoints,
      streak: userPoints.streak,
      correctCount: userPoints.correctCount,
    })
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1);
  const row = rows[0] ?? { totalPoints: 0, streak: 0, correctCount: 0 };

  // Total jugadores: count(*) sobre `users`. Todos los registrados
  // forman parte del ranking (incluso con 0 puntos) — la cifra
  // refleja la comunidad real, no solo los que han marcado puntos.
  const totalRows = await db.select({ total: sql<number>`count(*)::int` }).from(users);
  const total = totalRows[0]?.total ?? 0;

  // Rank: número de filas con más puntos + 1. Como el ranking es
  // inamovible (todos visibles), un user sin `user_points` se trata
  // como 0 puntos y recibe el rank de la cola.
  const aheadRows = await db
    .select({ ahead: sql<number>`count(*)::int` })
    .from(userPoints)
    .where(sql`${userPoints.totalPoints} > ${row.totalPoints}`);
  const rank: number = (aheadRows[0]?.ahead ?? 0) + 1;

  const unlockedRows = await db
    .select({ unlocked: sql<number>`count(*)::int` })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const unlocked = unlockedRows[0]?.unlocked ?? 0;

  return {
    totalPoints: row.totalPoints,
    streak: row.streak,
    correctCount: row.correctCount,
    achievementsUnlocked: unlocked,
    rank,
    totalPlayers: total,
  };
}

export async function countAchievementDefinitions(db: Database): Promise<number> {
  const rows = await db.select({ total: sql<number>`count(*)::int` }).from(achievementDefinitions);
  return rows[0]?.total ?? 0;
}

async function fetchPredictionForMatches(
  db: Database,
  userId: string,
  matchIds: string[],
): Promise<Map<string, PredictionView>> {
  if (matchIds.length === 0) return new Map();
  const rows = await db
    .select({
      matchId: predictions.matchId,
      kind: predictions.kind,
      predictedWinner: predictions.predictedWinner,
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
    })
    .from(predictions)
    .where(and(eq(predictions.userId, userId), inArray(predictions.matchId, matchIds)));
  return new Map(
    rows.map((r) => [
      r.matchId,
      {
        kind: r.kind,
        predictedWinner: r.predictedWinner,
        predictedHomeScore: r.predictedHomeScore,
        predictedAwayScore: r.predictedAwayScore,
      },
    ]),
  );
}

function teamView(row: {
  name: string;
  code: string;
  flag: string | null;
}): TeamView {
  return {
    name: row.name,
    flag: row.flag ?? null,
    code: row.code,
  };
}

export async function getLiveMatchForUser(
  db: Database,
  userId: string,
): Promise<LiveMatchView | null> {
  // Drizzle `alias()` para self-join (la misma tabla `teams` actúa
  // como home y away). Sin esto el SQL generado colapsaría las
  // columnas de los dos lados.
  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");
  const rows = await db
    .select({
      id: matches.id,
      stage: matches.stage,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeTeamName: homeTeam.name,
      homeTeamCode: homeTeam.code,
      homeTeamFlag: homeTeam.flag,
      awayTeamName: awayTeam.name,
      awayTeamCode: awayTeam.code,
      awayTeamFlag: awayTeam.flag,
    })
    .from(matches)
    .innerJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(eq(matches.status, "live"))
    .orderBy(asc(matches.kickoffAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const predictionMap = await fetchPredictionForMatches(db, userId, [row.id]);
  const prediction = predictionMap.get(row.id) ?? null;

  // Cálculo de puntos provisionales: si hay predicción + scores
  // visibles, ejecutamos el engine como si el partido acabara así.
  // El streak que pasamos es el actual del user (sin avanzar, no es
  // confirmado todavía).
  let provisional: LiveMatchView["provisional"] = null;
  if (prediction && row.homeScore !== null && row.awayScore !== null) {
    const streakRows = await db
      .select({ streak: userPoints.streak })
      .from(userPoints)
      .where(eq(userPoints.userId, userId))
      .limit(1);
    const streakBefore = {
      current: streakRows[0]?.streak ?? 0,
      containsDouble: false,
    };
    const scored = computeProvisionalScore(
      { stage: row.stage, homeScore: row.homeScore, awayScore: row.awayScore },
      prediction,
      streakBefore,
    );
    if (scored) {
      provisional = { points: scored.points, kind: scored.kind };
    }
  }

  return {
    matchId: row.id,
    stage: row.stage as MatchStage,
    homeTeam: teamView({
      name: row.homeTeamName,
      code: row.homeTeamCode,
      flag: row.homeTeamFlag,
    }),
    awayTeam: teamView({
      name: row.awayTeamName,
      code: row.awayTeamCode,
      flag: row.awayTeamFlag,
    }),
    homeScore: row.homeScore ?? 0,
    awayScore: row.awayScore ?? 0,
    // El minuto en vivo no está en el schema actual — vendrá con
    // `add-live-scoring` cuando expongamos goles parciales del provider.
    minute: null,
    prediction,
    provisional,
  };
}

export async function getUpcomingMatches(
  db: Database,
  userId: string,
  limit: number,
): Promise<UpcomingMatch[]> {
  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");
  const rows = await db
    .select({
      id: matches.id,
      stage: matches.stage,
      kickoffAt: matches.kickoffAt,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeTeamName: homeTeam.name,
      homeTeamCode: homeTeam.code,
      homeTeamFlag: homeTeam.flag,
      awayTeamName: awayTeam.name,
      awayTeamCode: awayTeam.code,
      awayTeamFlag: awayTeam.flag,
    })
    .from(matches)
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(
      and(
        gt(matches.kickoffAt, sql`now()`),
        inArray(matches.status, ["scheduled", "scheduled-tbd", "prediction-locked"]),
      ),
    )
    .orderBy(asc(matches.kickoffAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const matchIds = rows.map((r) => r.id);
  const predictionMap = await fetchPredictionForMatches(db, userId, matchIds);

  return rows.map((row) => ({
    matchId: row.id,
    stage: row.stage as MatchStage,
    kickoffAt: row.kickoffAt,
    homeTeam:
      row.homeTeamId && row.homeTeamName && row.homeTeamCode
        ? teamView({
            name: row.homeTeamName,
            code: row.homeTeamCode,
            flag: row.homeTeamFlag,
          })
        : null,
    awayTeam:
      row.awayTeamId && row.awayTeamName && row.awayTeamCode
        ? teamView({
            name: row.awayTeamName,
            code: row.awayTeamCode,
            flag: row.awayTeamFlag,
          })
        : null,
    prediction: predictionMap.get(row.id) ?? null,
  }));
}

export async function getProgress(db: Database, userId: string): Promise<Progress> {
  // Achievements: unlocked + último desbloqueado.
  const last = await db
    .select({
      title: achievementDefinitions.title,
      unlockedAt: userAchievements.unlockedAt,
    })
    .from(userAchievements)
    .innerJoin(
      achievementDefinitions,
      eq(achievementDefinitions.id, userAchievements.achievementId),
    )
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.unlockedAt))
    .limit(1);

  const progressUnlockedRows = await db
    .select({ unlocked: sql<number>`count(*)::int` })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const unlocked = progressUnlockedRows[0]?.unlocked ?? 0;

  const progressTotalRows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(achievementDefinitions);
  const total = progressTotalRows[0]?.total ?? 0;

  // Rank actual. Todos los users tienen un rank — incluso los que
  // aún no han ganado puntos (su totalPoints efectivo es 0). Por eso
  // contamos contra `userPoints` con `> 0`, garantizando que
  // cualquiera "sin fila en user_points" reciba rank = (cantidad de
  // users con puntos) + 1.
  const userRow = await db
    .select({ totalPoints: userPoints.totalPoints })
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1);
  const userTotal = userRow[0]?.totalPoints ?? 0;
  const aheadRows = await db
    .select({ ahead: sql<number>`count(*)::int` })
    .from(userPoints)
    .where(sql`${userPoints.totalPoints} > ${userTotal}`);
  const rank: number = (aheadRows[0]?.ahead ?? 0) + 1;

  // Histórico de los últimos 7 snapshots para sparkline + delta. Si
  // todavía no hay snapshots (cron no ejecutado o user nuevo),
  // `weekAgoRank` y `sparkline` quedan en null y la UI muestra el
  // placeholder "El histórico empieza pronto".
  const history = await getRankHistory(db, userId);
  // rankDelta positivo significa que has SUBIDO posiciones (rank
  // numéricamente menor). Convención: ▲ +N para "has subido N",
  // ▼ -N para "has bajado N". Sin histórico → null.
  const rankDelta =
    history.weekAgoRank === null ? null : history.weekAgoRank - rank;
  // Sparkline: incluimos el snapshot del momento al final para que la
  // gráfica refleje el rank actual sin esperar al cron de mañana.
  const sparkline =
    history.sparkline === null ? null : [...history.sparkline, rank];

  return {
    rank: { rank, rankDelta, sparkline },
    achievements: {
      unlocked,
      total,
      lastUnlockedTitle: last[0]?.title ?? null,
      lastUnlockedAt: last[0]?.unlockedAt ?? null,
    },
  };
}

export async function getMiniLeaderboard(
  db: Database,
  userId: string,
  topCount: number,
): Promise<MiniLeaderboardView> {
  // Top N por puntos descendente. Incluimos username para que la
  // fila pueda enlazar a `/u/<username>`.
  const topRows = await db
    .select({
      userId: userPoints.userId,
      points: userPoints.totalPoints,
      name: users.name,
      username: users.username,
      country: users.country,
    })
    .from(userPoints)
    .innerJoin(users, eq(users.id, userPoints.userId))
    .orderBy(desc(userPoints.totalPoints), asc(userPoints.userId))
    .limit(topCount);

  const top: LeaderboardEntry[] = topRows.map((row, idx) => ({
    userId: row.userId,
    name: row.name ?? "—",
    username: row.username,
    countryCode: row.country,
    points: row.points,
    rank: idx + 1,
  }));

  // Fila del user con su rank real.
  const meRow = await db
    .select({
      points: userPoints.totalPoints,
      name: users.name,
      username: users.username,
      country: users.country,
    })
    .from(userPoints)
    .innerJoin(users, eq(users.id, userPoints.userId))
    .where(eq(userPoints.userId, userId))
    .limit(1);

  let me: LeaderboardEntry | null = null;
  const meData = meRow[0];
  if (meData) {
    const meAheadRows = await db
      .select({ ahead: sql<number>`count(*)::int` })
      .from(userPoints)
      .where(sql`${userPoints.totalPoints} > ${meData.points}`);
    me = {
      userId,
      name: meData.name ?? "—",
      username: meData.username,
      countryCode: meData.country,
      points: meData.points,
      rank: (meAheadRows[0]?.ahead ?? 0) + 1,
    };
  }

  return buildMiniLeaderboard(top, me);
}

/**
 * Variante del mini-leaderboard filtrada a "yo + mis amigos
 * aceptados". Misma forma que el global para que el cliente reuse
 * el componente `<MiniLeaderboard>` cambiando solo el `mini` prop.
 *
 * Casos especiales:
 *  - Sin amigos: devuelve `top: []`, `me: null`, `friendsCount: 0`.
 *    El widget oculta la tab "Amigos" en este caso.
 *  - Amigo sin row en `user_points` (cuenta nueva sin puntos): se
 *    incluye igualmente con `points: 0`. El ranking es inamovible.
 *
 * El `rank` que devolvemos es **relativo al subset de amigos**, no
 * global — para que en la tab "Amigos" tu posición refleje el
 * ranking dentro del grupo.
 */
export async function getFriendsMiniLeaderboard(
  db: Database,
  userId: string,
  topCount: number,
): Promise<FriendsMiniLeaderboardView> {
  // IDs del grupo: yo + amigos aceptados (en cualquier dirección de
  // la relación). Resolvemos primero los IDs para reusar la lista en
  // el counter y el top.
  const friendRows = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    );

  const friendIds = friendRows.map((r) =>
    r.requesterId === userId ? r.addresseeId : r.requesterId,
  );
  const friendsCount = friendIds.length;
  const groupIds = [userId, ...friendIds];

  // Sin amigos → top vacío, me nulo. La UI oculta la tab.
  if (friendsCount === 0) {
    return { top: [], me: null, friendsCount: 0 };
  }

  // Top N entre el grupo. LEFT JOIN para incluir users sin
  // user_points (cuentas nuevas). Incluimos username para que la
  // fila pueda enlazar a `/u/<username>`.
  const topRows = await db
    .select({
      userId: users.id,
      name: users.name,
      username: users.username,
      country: users.country,
      points: userPoints.totalPoints,
    })
    .from(users)
    .leftJoin(userPoints, eq(userPoints.userId, users.id))
    .where(inArray(users.id, groupIds))
    .orderBy(desc(sql`coalesce(${userPoints.totalPoints}, 0)`), asc(users.id))
    .limit(topCount);

  const top: LeaderboardEntry[] = topRows.map((row, idx) => ({
    userId: row.userId,
    name: row.name?.trim() || "Jugador",
    username: row.username,
    countryCode: row.country,
    points: row.points ?? 0,
    rank: idx + 1,
  }));

  // ¿El user ya aparece en el top? Si sí, `me` queda null para no
  // duplicar — comportamiento idéntico a `getMiniLeaderboard` global.
  const meInTop = top.find((row) => row.userId === userId);
  if (meInTop) {
    return { top, me: null, friendsCount };
  }

  // El user no entró en el top → calcular su rank dentro del grupo.
  const meRows = await db
    .select({
      name: users.name,
      username: users.username,
      country: users.country,
      points: userPoints.totalPoints,
    })
    .from(users)
    .leftJoin(userPoints, eq(userPoints.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  const meData = meRows[0];
  if (!meData) return { top, me: null, friendsCount };

  const myPoints = meData.points ?? 0;
  const aheadInGroup = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userPoints)
    .where(
      and(
        inArray(userPoints.userId, groupIds),
        sql`${userPoints.totalPoints} > ${myPoints}`,
      ),
    );
  const me: LeaderboardEntry = {
    userId,
    name: meData.name?.trim() || "Jugador",
    username: meData.username,
    countryCode: meData.country,
    points: myPoints,
    rank: (aheadInGroup[0]?.n ?? 0) + 1,
  };
  return { top, me, friendsCount };
}
