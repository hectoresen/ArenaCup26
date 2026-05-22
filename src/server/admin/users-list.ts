import { db } from "@/server/db/client";
import {
  friendships,
  groupMemberships,
  predictions,
  userAchievements,
  userPoints,
  users,
} from "@/server/db/schema";
import { and, asc, desc, eq, gt, ilike, or, sql } from "drizzle-orm";

/**
 * Filtros del listado de usuarios del admin. `null` = sin filtrar
 * por ese eje. Multi-axis: si los tres están set, se aplican con AND.
 */
export type UserListFilter = {
  /** `human` excluye bots, `bot` solo bots, `all` ambos. */
  kind: "human" | "bot" | "all";
  /** `banned` solo con `banned_until > now()`, `active` opuesto, `all` ambos. */
  ban: "active" | "banned" | "all";
  /** Substring case-insensitive en email, nombre o username. */
  search: string | null;
};

export type UserListRow = {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  country: string | null;
  image: string | null;
  avatarId: string | null;
  isBot: boolean;
  isAdmin: boolean;
  bannedUntil: Date | null;
  createdAt: Date;
  totalPoints: number;
  predictionsCount: number;
};

export type UserListPage = {
  rows: UserListRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

const DEFAULT_PAGE_SIZE = 25;

/**
 * Listado paginado para `/admin/users`. La query une users con
 * `user_points` y `predictions` agregadas para mostrar puntos y
 * número de predicciones en una sola roundtrip — al volumen del
 * proyecto (≈5K humanos + bots) la suma sale en < 100ms con los
 * índices actuales (`predictions_user_id_idx`).
 *
 * Orden: humanos antes que bots, luego por puntos desc. Estable
 * con `id` como tiebreaker para que la paginación no salte rows.
 */
export async function listUsersForAdmin(input: {
  filter: UserListFilter;
  page?: number;
  pageSize?: number;
}): Promise<UserListPage> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const filters = [];
  if (input.filter.kind === "human") filters.push(eq(users.isBot, false));
  if (input.filter.kind === "bot") filters.push(eq(users.isBot, true));
  if (input.filter.ban === "banned") filters.push(gt(users.bannedUntil, new Date()));
  if (input.filter.ban === "active") {
    filters.push(sql`(${users.bannedUntil} IS NULL OR ${users.bannedUntil} <= now())`);
  }
  if (input.filter.search && input.filter.search.trim().length > 0) {
    const pattern = `%${input.filter.search.trim()}%`;
    filters.push(
      or(ilike(users.email, pattern), ilike(users.name, pattern), ilike(users.username, pattern))!,
    );
  }
  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause);

  const total = countRow?.total ?? 0;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      username: users.username,
      country: users.country,
      image: users.image,
      avatarId: users.avatarId,
      isBot: users.isBot,
      isAdmin: users.isAdmin,
      bannedUntil: users.bannedUntil,
      createdAt: users.createdAt,
      totalPoints: sql<number>`coalesce(${userPoints.totalPoints}, 0)::int`,
      predictionsCount: sql<number>`
        coalesce(
          (select count(*)::int from ${predictions} where ${predictions.userId} = ${users.id}),
          0
        )
      `,
    })
    .from(users)
    .leftJoin(userPoints, eq(userPoints.userId, users.id))
    .where(whereClause)
    .orderBy(asc(users.isBot), desc(userPoints.totalPoints), asc(users.id))
    .limit(pageSize)
    .offset(offset);

  return {
    rows,
    total,
    page,
    pageSize,
    hasMore: offset + rows.length < total,
  };
}

export type UserDetail = {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  country: string | null;
  image: string | null;
  avatarId: string | null;
  privacy: unknown;
  isBot: boolean;
  isAdmin: boolean;
  bannedUntil: Date | null;
  onboardedAt: Date | null;
  lastActiveAt: Date | null;
  createdAt: Date;
  nameChangedAt: Date | null;
  avatarChangedAt: Date | null;
  stats: {
    totalPoints: number;
    predictionsCount: number;
    achievementsCount: number;
    friendsCount: number;
    groupsCount: number;
  };
};

/**
 * Carga detalle completo de un user para `/admin/users/[id]`.
 * Todas las agregaciones en paralelo (≈5 queries pequeñas) para
 * minimizar latencia total.
 */
export async function getUserDetailForAdmin(id: string): Promise<UserDetail | null> {
  const [u, pointsRow, achCountRow, friendsCountRow, groupsCountRow, predCountRow] =
    await Promise.all([
      db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
        .then((r) => r[0] ?? null),
      db
        .select({ points: userPoints.totalPoints })
        .from(userPoints)
        .where(eq(userPoints.userId, id))
        .limit(1)
        .then((r) => r[0]?.points ?? 0),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(userAchievements)
        .where(eq(userAchievements.userId, id))
        .then((r) => r[0]?.c ?? 0),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(friendships)
        .where(
          and(
            eq(friendships.status, "accepted"),
            or(eq(friendships.requesterId, id), eq(friendships.addresseeId, id))!,
          ),
        )
        .then((r) => r[0]?.c ?? 0),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(groupMemberships)
        .where(and(eq(groupMemberships.userId, id), sql`${groupMemberships.leftAt} IS NULL`))
        .then((r) => r[0]?.c ?? 0),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(predictions)
        .where(eq(predictions.userId, id))
        .then((r) => r[0]?.c ?? 0),
    ]);

  if (!u) return null;

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    country: u.country,
    image: u.image,
    avatarId: u.avatarId,
    privacy: u.privacy,
    isBot: u.isBot,
    isAdmin: u.isAdmin,
    bannedUntil: u.bannedUntil,
    onboardedAt: u.onboardedAt,
    lastActiveAt: u.lastActiveAt,
    createdAt: u.createdAt,
    nameChangedAt: u.nameChangedAt,
    avatarChangedAt: u.avatarChangedAt,
    stats: {
      totalPoints: pointsRow,
      predictionsCount: predCountRow,
      achievementsCount: achCountRow,
      friendsCount: friendsCountRow,
      groupsCount: groupsCountRow,
    },
  };
}
