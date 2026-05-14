import { countryCodeToFlag } from "@/lib/format/country";
import type { Database } from "@/server/db/client";
import {
  achievementDefinitions,
  matches,
  predictions,
  teams,
  userAchievements,
  userPoints,
  users,
} from "@/server/db/schema";
import type { MatchStage } from "@/server/scoring/types";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { UPCOMING_LIMIT, buildMiniLeaderboard, sortUpcomingMatches } from "./transforms";
import type {
  DashboardData,
  LeaderboardEntry,
  LiveMatchView,
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

  const [stats, live, upcomingRaw, progress, miniRaw, achievementsTotal] = await Promise.all([
    getUserStats(db, userId),
    getLiveMatchForUser(db, userId),
    getUpcomingMatches(db, userId, UPCOMING_LIMIT * 2),
    getProgress(db, userId),
    getMiniLeaderboard(db, userId, 5),
    countAchievementDefinitions(db),
  ]);

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
    mini: miniRaw,
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

  // Total jugadores: count(*) de users con al menos 1 punto. Mantiene
  // el "12 480 jugadores" honesto (los registrados sin actividad no
  // cuentan como rivales).
  const totalRows = await db.select({ total: sql<number>`count(*)::int` }).from(userPoints);
  const total = totalRows[0]?.total ?? 0;

  // Rank: número de filas con más puntos + 1. Si el user no tiene
  // userPoints (no ha jugado), rank queda null.
  let rank: number | null = null;
  if (rows.length > 0) {
    const aheadRows = await db
      .select({ ahead: sql<number>`count(*)::int` })
      .from(userPoints)
      .where(sql`${userPoints.totalPoints} > ${row.totalPoints}`);
    rank = (aheadRows[0]?.ahead ?? 0) + 1;
  }

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
    prediction: predictionMap.get(row.id) ?? null,
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

  // Rank actual; delta/sparkline quedan null hasta `add-ranking-history`.
  const userRow = await db
    .select({ totalPoints: userPoints.totalPoints })
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1);

  let rank: number | null = null;
  if (userRow[0]) {
    const userTotal = userRow[0].totalPoints;
    const aheadRows = await db
      .select({ ahead: sql<number>`count(*)::int` })
      .from(userPoints)
      .where(sql`${userPoints.totalPoints} > ${userTotal}`);
    rank = (aheadRows[0]?.ahead ?? 0) + 1;
  }

  return {
    rank: { rank, rankDelta: null, sparkline: null },
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
  // Top N por puntos descendente.
  const topRows = await db
    .select({
      userId: userPoints.userId,
      points: userPoints.totalPoints,
      name: users.name,
      country: users.country,
    })
    .from(userPoints)
    .innerJoin(users, eq(users.id, userPoints.userId))
    .orderBy(desc(userPoints.totalPoints), asc(userPoints.userId))
    .limit(topCount);

  const top: LeaderboardEntry[] = topRows.map((row, idx) => ({
    userId: row.userId,
    name: row.name ?? "—",
    flag: countryCodeToFlag(row.country),
    points: row.points,
    rank: idx + 1,
  }));

  // Fila del user con su rank real.
  const meRow = await db
    .select({
      points: userPoints.totalPoints,
      name: users.name,
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
      flag: countryCodeToFlag(meData.country),
      points: meData.points,
      rank: (meAheadRows[0]?.ahead ?? 0) + 1,
    };
  }

  return buildMiniLeaderboard(top, me);
}
