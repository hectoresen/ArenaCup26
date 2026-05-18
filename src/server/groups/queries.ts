import { and, asc, desc, eq, isNull, isNotNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/server/db/client";
import {
  type GroupColor,
  groupInvitations,
  groupLinks,
  groupMemberships,
  groups,
  predictions,
  rankingSnapshots,
  userPoints,
  users,
} from "@/server/db/schema";
import { buildGroupInviteUrl } from "./tokens";
import { countActiveMembers } from "./caps";
import type {
  GroupDetail,
  GroupInvitationRow,
  GroupLinkRow,
  GroupMemberRow,
  GroupRankingEntry,
  GroupSummary,
} from "./types";

/**
 * Lista los grupos en los que el user es miembro activo (sin contar
 * ex-miembros congelados, que aparecen como "grupos del histórico"
 * en otro sitio si decidimos exponerlos). Devuelve también el rol y
 * el conteo de miembros activos para pintar las cards de
 * "Mis grupos" en /social.
 */
export async function getUserGroups(db: Database, userId: string): Promise<GroupSummary[]> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      color: groups.color,
      visibility: groups.visibility,
      maxMembers: groups.maxMembers,
      role: groupMemberships.role,
    })
    .from(groups)
    .innerJoin(groupMemberships, eq(groupMemberships.groupId, groups.id))
    .where(
      and(
        eq(groupMemberships.userId, userId),
        isNull(groupMemberships.leftAt),
        isNull(groups.deletedAt),
      ),
    )
    .orderBy(asc(groups.name));

  if (rows.length === 0) return [];

  // Conteo de miembros activos por grupo en una sola query (no N+1).
  const groupIds = rows.map((r) => r.id);
  const counts = await db
    .select({
      groupId: groupMemberships.groupId,
      total: sql<number>`count(*)::int`,
    })
    .from(groupMemberships)
    .where(
      and(
        sql`${groupMemberships.groupId} = ANY(${groupIds})`,
        isNull(groupMemberships.leftAt),
      ),
    )
    .groupBy(groupMemberships.groupId);
  const countMap = new Map(counts.map((c) => [c.groupId, c.total]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color as GroupColor,
    visibility: r.visibility,
    maxMembers: r.maxMembers,
    memberCount: countMap.get(r.id) ?? 0,
    viewerRole: r.role,
  }));
}

/**
 * Lista grupos PÚBLICOS no-borrados para la página descubrir. Excluye
 * los que el viewer ya es miembro (no tiene sentido descubrir lo que
 * ya tienes). Paginación simple por offset; suficiente mientras los
 * grupos sean ≤ 1000.
 */
export async function getDiscoverableGroups(
  db: Database,
  viewerId: string | null,
  options: { limit?: number; offset?: number; search?: string } = {},
): Promise<GroupSummary[]> {
  const { limit = 30, offset = 0, search } = options;

  const conds = [
    eq(groups.visibility, "public" as const),
    isNull(groups.deletedAt),
  ];
  if (search && search.trim().length > 0) {
    conds.push(sql`${groups.name} ILIKE ${"%" + search.trim() + "%"}`);
  }

  const baseQuery = db
    .select({
      id: groups.id,
      name: groups.name,
      color: groups.color,
      visibility: groups.visibility,
      maxMembers: groups.maxMembers,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM ${groupMemberships}
        WHERE ${groupMemberships.groupId} = ${groups.id}
          AND ${groupMemberships.leftAt} IS NULL
      )`,
    })
    .from(groups)
    .where(and(...conds))
    .orderBy(asc(groups.name))
    .limit(limit)
    .offset(offset);

  const rows = await baseQuery;

  // Filtro client-side de "soy miembro": más simple que un NOT EXISTS
  // anidado en Drizzle. Para listings de ≤30 elementos es trivial.
  let filtered = rows;
  if (viewerId) {
    const memberRows = await db
      .selectDistinct({ groupId: groupMemberships.groupId })
      .from(groupMemberships)
      .where(and(eq(groupMemberships.userId, viewerId), isNull(groupMemberships.leftAt)));
    const memberSet = new Set(memberRows.map((m) => m.groupId));
    filtered = rows.filter((r) => !memberSet.has(r.id));
  }

  return filtered.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color as GroupColor,
    visibility: r.visibility,
    maxMembers: r.maxMembers,
    memberCount: r.memberCount,
    viewerRole: null,
  }));
}

/**
 * Carga el detalle de un grupo con la info de membership del viewer.
 * Devuelve null si el grupo no existe, está borrado, o el viewer no
 * tiene acceso (no es miembro activo, no es ex-miembro, y el grupo
 * NO es público).
 */
export async function getGroupDetail(
  db: Database,
  groupId: string,
  viewerId: string | null,
): Promise<GroupDetail | null> {
  const rows = await db
    .select({
      id: groups.id,
      creatorId: groups.creatorId,
      name: groups.name,
      color: groups.color,
      visibility: groups.visibility,
      maxMembers: groups.maxMembers,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1);
  const group = rows[0];
  if (!group) return null;

  // Resolución del rol del viewer + estado (activo / congelado / nada).
  let viewerRole: GroupDetail["viewerRole"] = null;
  let viewerIsFrozen = false;
  if (viewerId) {
    const membRows = await db
      .select({ role: groupMemberships.role, leftAt: groupMemberships.leftAt })
      .from(groupMemberships)
      .where(
        and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, viewerId)),
      )
      .limit(1);
    const memb = membRows[0];
    if (memb) {
      if (memb.leftAt === null) {
        viewerRole = memb.role;
      } else {
        viewerIsFrozen = true;
      }
    }
  }

  // Privacidad: si el viewer no es miembro activo ni ex-miembro y el
  // grupo es privado, no devolvemos nada.
  if (viewerRole === null && !viewerIsFrozen && group.visibility === "private") {
    return null;
  }

  const memberCount = await countActiveMembers(db, group.id);

  return {
    id: group.id,
    creatorId: group.creatorId,
    name: group.name,
    color: group.color as GroupColor,
    visibility: group.visibility,
    maxMembers: group.maxMembers,
    memberCount,
    viewerRole,
    viewerIsFrozen,
    viewerIsAdmin: viewerRole === "admin",
    createdAt: group.createdAt,
  };
}

/**
 * Ranking del grupo: filtro + reorder sobre `user_points` para los
 * miembros activos, fusionado con los ex-miembros congelados. Mismo
 * tie-break que el global (puntos → streakMax → simpleHits →
 * predictionsCount → createdAt).
 *
 * Computa `rankDelta` (vs rank-en-grupo de hace 7 días) derivado del
 * snapshot global: tomamos las filas más recientes de
 * `ranking_snapshots` de hace ~7 días y rerankeamos en memoria
 * filtrando por miembros del grupo. Si no hay historial suficiente,
 * `rankDelta` queda `null`.
 */
export async function getGroupRanking(
  db: Database,
  groupId: string,
): Promise<GroupRankingEntry[]> {
  // 1) Memberships del grupo (activos + congelados) con datos del user.
  const memberRows = await db
    .select({
      userId: groupMemberships.userId,
      leftAt: groupMemberships.leftAt,
      frozenPoints: groupMemberships.frozenPoints,
      frozenStreakMax: groupMemberships.frozenStreakMax,
      frozenSimpleHits: groupMemberships.frozenSimpleHits,
      username: users.username,
      name: users.name,
      country: users.country,
      avatarId: users.avatarId,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(groupMemberships)
    .innerJoin(users, eq(users.id, groupMemberships.userId))
    .where(eq(groupMemberships.groupId, groupId));

  if (memberRows.length === 0) return [];

  // 2) user_points para activos (los congelados ya traen sus puntos).
  const activeUserIds = memberRows.filter((r) => r.leftAt === null).map((r) => r.userId);
  const pointsRows = activeUserIds.length
    ? await db
        .select({
          userId: userPoints.userId,
          totalPoints: userPoints.totalPoints,
          streak: userPoints.streak,
          streakMax: userPoints.streakMax,
          correctCount: userPoints.correctCount,
          simpleHits: userPoints.simpleHits,
        })
        .from(userPoints)
        .where(sql`${userPoints.userId} = ANY(${activeUserIds})`)
    : [];
  const pointsMap = new Map(pointsRows.map((p) => [p.userId, p]));

  // 3) Conteo de predicciones por user (tie-break 4º criterio).
  const predRows = await db
    .select({
      userId: predictions.userId,
      total: sql<number>`count(*)::int`,
    })
    .from(predictions)
    .where(sql`${predictions.userId} = ANY(${memberRows.map((m) => m.userId)})`)
    .groupBy(predictions.userId);
  const predMap = new Map(predRows.map((p) => [p.userId, p.total]));

  // 4) Fusionar y ordenar con el tie-break completo.
  type Row = {
    userId: string;
    username: string | null;
    name: string;
    countryCode: string | null;
    avatarId: string | null;
    image: string | null;
    points: number;
    streak: number;
    streakMax: number;
    correctCount: number;
    simpleHits: number;
    predictionsTotal: number;
    createdAt: Date;
    frozen: boolean;
  };
  const merged: Row[] = memberRows.map((m) => {
    const isFrozen = m.leftAt !== null;
    if (isFrozen) {
      return {
        userId: m.userId,
        username: m.username,
        name: m.name?.trim() || "Jugador",
        countryCode: m.country,
        avatarId: m.avatarId,
        image: m.image,
        points: m.frozenPoints ?? 0,
        streak: 0,
        streakMax: m.frozenStreakMax ?? 0,
        correctCount: 0,
        simpleHits: m.frozenSimpleHits ?? 0,
        predictionsTotal: predMap.get(m.userId) ?? 0,
        createdAt: m.createdAt,
        frozen: true,
      };
    }
    const p = pointsMap.get(m.userId);
    return {
      userId: m.userId,
      username: m.username,
      name: m.name?.trim() || "Jugador",
      countryCode: m.country,
      avatarId: m.avatarId,
      image: m.image,
      points: p?.totalPoints ?? 0,
      streak: p?.streak ?? 0,
      streakMax: p?.streakMax ?? 0,
      correctCount: p?.correctCount ?? 0,
      simpleHits: p?.simpleHits ?? 0,
      predictionsTotal: predMap.get(m.userId) ?? 0,
      createdAt: m.createdAt,
      frozen: false,
    };
  });

  // Mismo tie-break que getRealSnapshot global.
  merged.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.streakMax !== a.streakMax) return b.streakMax - a.streakMax;
    if (b.simpleHits !== a.simpleHits) return b.simpleHits - a.simpleHits;
    if (b.predictionsTotal !== a.predictionsTotal) return b.predictionsTotal - a.predictionsTotal;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // 5) Rank delta (vs ranking-de-este-grupo de hace 7d) — best-effort.
  //    `ranking_snapshots` solo guarda el rank GLOBAL y totalPoints
  //    del día. Para derivar el rank-en-grupo de hace 7d basta con:
  //      a) tomar el último snapshot ≤ 7d de cada miembro,
  //      b) ordenarlos por su rank-global asc (más bajo = mejor),
  //      c) la posición resultante = rank-en-grupo histórico.
  //    Si un miembro no tiene snapshot a esa fecha (user nuevo o
  //    ex-miembro), su delta queda null.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const memberUserIds = merged.map((m) => m.userId);
  const snapshotRows = await db
    .select({
      userId: rankingSnapshots.userId,
      rank: rankingSnapshots.rank,
    })
    .from(rankingSnapshots)
    .where(
      and(
        sql`${rankingSnapshots.userId} = ANY(${memberUserIds})`,
        sql`${rankingSnapshots.snapshotDate} <= ${sevenDaysAgo}`,
      ),
    )
    .orderBy(desc(rankingSnapshots.snapshotDate));

  // Tomar el snapshot MÁS RECIENTE ≤ 7d para cada user (el primero
  // que aparece en el orden desc).
  const seenInSnap = new Set<string>();
  type SnapRow = (typeof snapshotRows)[number];
  const lastSnapByUser: SnapRow[] = [];
  for (const s of snapshotRows) {
    if (seenInSnap.has(s.userId)) continue;
    seenInSnap.add(s.userId);
    lastSnapByUser.push(s);
  }

  // Ordenar por rank GLOBAL ascendente (menor = mejor) → position
  // dentro del grupo = group-rank-de-hace-7d.
  const snapRanked = [...lastSnapByUser].sort((a, b) => a.rank - b.rank);
  const rankInSnapByUser = new Map(snapRanked.map((s, i) => [s.userId, i + 1]));

  return merged.map((m, i) => {
    const currentRank = i + 1;
    const snapRank = rankInSnapByUser.get(m.userId);
    const rankDelta = snapRank ? snapRank - currentRank : null;
    return {
      userId: m.userId,
      username: m.username,
      name: m.name,
      countryCode: m.countryCode,
      avatarId: m.avatarId,
      image: m.image,
      points: m.points,
      streak: m.streak,
      correctCount: m.correctCount,
      frozen: m.frozen,
      rank: currentRank,
      rankDelta,
    };
  });
}

/**
 * Lista de miembros para el admin panel. Incluye ex-miembros para
 * que el admin pueda ver el histórico, pero el listado activo es
 * el que admite acciones (expulsar / transferir admin).
 */
export async function getGroupMembers(
  db: Database,
  groupId: string,
): Promise<GroupMemberRow[]> {
  const rows = await db
    .select({
      userId: groupMemberships.userId,
      role: groupMemberships.role,
      joinedAt: groupMemberships.joinedAt,
      leftAt: groupMemberships.leftAt,
      username: users.username,
      name: users.name,
      avatarId: users.avatarId,
      image: users.image,
    })
    .from(groupMemberships)
    .innerJoin(users, eq(users.id, groupMemberships.userId))
    .where(eq(groupMemberships.groupId, groupId))
    .orderBy(
      // Activos primero, después ex-miembros más recientes primero.
      sql`CASE WHEN ${groupMemberships.leftAt} IS NULL THEN 0 ELSE 1 END`,
      asc(groupMemberships.joinedAt),
    );

  return rows.map((r) => ({
    userId: r.userId,
    username: r.username,
    name: r.name?.trim() || "Jugador",
    avatarId: r.avatarId,
    image: r.image,
    role: r.role,
    joinedAt: r.joinedAt,
    leftAt: r.leftAt,
  }));
}

/**
 * Invitaciones pending recibidas por el user. Se muestran en /social
 * como una bandeja al lado de las solicitudes de amistad.
 */
export async function getPendingGroupInvitations(
  db: Database,
  userId: string,
): Promise<GroupInvitationRow[]> {
  const inviter = alias(users, "inviter_user");
  const rows = await db
    .select({
      invitationId: groupInvitations.id,
      groupId: groupInvitations.groupId,
      groupName: groups.name,
      groupColor: groups.color,
      invitedByName: inviter.name,
      createdAt: groupInvitations.createdAt,
    })
    .from(groupInvitations)
    .innerJoin(groups, eq(groups.id, groupInvitations.groupId))
    .leftJoin(inviter, eq(inviter.id, groupInvitations.invitedBy))
    .where(
      and(
        eq(groupInvitations.inviteeId, userId),
        eq(groupInvitations.status, "pending"),
        isNull(groups.deletedAt),
      ),
    )
    .orderBy(desc(groupInvitations.createdAt));

  return rows.map((r) => ({
    invitationId: r.invitationId,
    groupId: r.groupId,
    groupName: r.groupName,
    groupColor: r.groupColor as GroupColor,
    invitedByName: r.invitedByName,
    createdAt: r.createdAt,
  }));
}

/**
 * Links activos del grupo. Solo se llama desde el admin panel.
 * Incluye expirados (`maxUses > 0 && uses >= maxUses`) para que el
 * admin sepa cuáles ya no funcionan. Revocados se incluyen también
 * con flag para histórico.
 */
export async function getGroupLinks(
  db: Database,
  groupId: string,
): Promise<GroupLinkRow[]> {
  const rows = await db
    .select({
      linkId: groupLinks.id,
      token: groupLinks.token,
      maxUses: groupLinks.maxUses,
      uses: groupLinks.uses,
      revokedAt: groupLinks.revokedAt,
      createdAt: groupLinks.createdAt,
    })
    .from(groupLinks)
    .where(eq(groupLinks.groupId, groupId))
    .orderBy(desc(groupLinks.createdAt));

  return rows.map((r) => ({
    linkId: r.linkId,
    token: r.token,
    maxUses: r.maxUses,
    uses: r.uses,
    revokedAt: r.revokedAt,
    createdAt: r.createdAt,
    url: buildGroupInviteUrl(r.token),
  }));
}

/**
 * Invitaciones salientes pending de UN grupo (vista del admin). A
 * diferencia de `getPendingGroupInvitations` (entrantes para el user),
 * ésta devuelve el listado para que el admin vea a quién ha invitado
 * y pueda cancelar.
 */
export async function getOutboundGroupInvitations(
  db: Database,
  groupId: string,
): Promise<
  Array<{
    invitationId: string;
    groupId: string;
    groupName: string;
    groupColor: GroupColor;
    invitedByName: string | null;
    inviteeName: string | null;
    inviteeUsername: string | null;
    createdAt: Date;
  }>
> {
  const invitee = alias(users, "invitee_user");
  const rows = await db
    .select({
      invitationId: groupInvitations.id,
      groupId: groupInvitations.groupId,
      groupName: groups.name,
      groupColor: groups.color,
      inviteeName: invitee.name,
      inviteeUsername: invitee.username,
      createdAt: groupInvitations.createdAt,
    })
    .from(groupInvitations)
    .innerJoin(groups, eq(groups.id, groupInvitations.groupId))
    .leftJoin(invitee, eq(invitee.id, groupInvitations.inviteeId))
    .where(
      and(
        eq(groupInvitations.groupId, groupId),
        eq(groupInvitations.status, "pending"),
      ),
    )
    .orderBy(desc(groupInvitations.createdAt));

  return rows.map((r) => ({
    invitationId: r.invitationId,
    groupId: r.groupId,
    groupName: r.groupName,
    groupColor: r.groupColor as GroupColor,
    invitedByName: null,
    inviteeName: r.inviteeName,
    inviteeUsername: r.inviteeUsername,
    createdAt: r.createdAt,
  }));
}

/**
 * Lookup de un grupo por token de link (para landing de
 * `/social/grupos/unirse/<token>`). Devuelve preview info + estado
 * del link. No persiste nada.
 */
export type GroupLinkPreview =
  | {
      ok: true;
      groupId: string;
      groupName: string;
      groupColor: GroupColor;
      memberCount: number;
      maxMembers: number;
    }
  | { ok: false; code: "not_found" | "revoked" | "exhausted" | "group_deleted" };

export async function previewGroupLink(
  db: Database,
  token: string,
): Promise<GroupLinkPreview> {
  const rows = await db
    .select({
      groupId: groups.id,
      groupName: groups.name,
      groupColor: groups.color,
      groupDeleted: groups.deletedAt,
      maxMembers: groups.maxMembers,
      linkRevoked: groupLinks.revokedAt,
      linkMaxUses: groupLinks.maxUses,
      linkUses: groupLinks.uses,
    })
    .from(groupLinks)
    .innerJoin(groups, eq(groups.id, groupLinks.groupId))
    .where(eq(groupLinks.token, token))
    .limit(1);
  const r = rows[0];
  if (!r) return { ok: false, code: "not_found" };
  if (r.groupDeleted) return { ok: false, code: "group_deleted" };
  if (r.linkRevoked) return { ok: false, code: "revoked" };
  if (r.linkMaxUses > 0 && r.linkUses >= r.linkMaxUses) {
    return { ok: false, code: "exhausted" };
  }
  const memberCount = await countActiveMembers(db, r.groupId);
  return {
    ok: true,
    groupId: r.groupId,
    groupName: r.groupName,
    groupColor: r.groupColor as GroupColor,
    memberCount,
    maxMembers: r.maxMembers,
  };
}
