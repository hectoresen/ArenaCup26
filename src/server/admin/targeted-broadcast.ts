import { db } from "@/server/db/client";
import { groupMemberships, groups, notifications, userPoints, users } from "@/server/db/schema";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

/**
 * Objetivo de la notificación. Discriminated union — el caller
 * compone uno de estos y la resolución a la lista final de userIds
 * la hace `resolveTargetUserIds`.
 *
 * - `all`: todos los humanos (NOT bot, NOT banned).
 * - `users`: lista directa por email o username (uno por línea).
 * - `group`: miembros activos (no left) de un grupo concreto.
 * - `filter`: AND de los tres filtros opcionales (país, top N
 *   ranking, activos en últimos N días).
 */
export const TargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({
    kind: z.literal("users"),
    /** Emails o usernames, máximo 200 por seguridad. */
    identifiers: z.array(z.string().trim().min(1)).min(1).max(200),
  }),
  z.object({
    kind: z.literal("group"),
    groupId: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("filter"),
    countries: z.array(z.string().length(3)).optional(),
    topN: z.number().int().min(1).max(10000).optional(),
    activeSinceDays: z.number().int().min(1).max(365).optional(),
  }),
]);

export type BroadcastTarget = z.infer<typeof TargetSchema>;

/**
 * Devuelve la lista final de userIds según el target. Siempre filtra
 * bots y banned (no queremos notificar a perfiles sintéticos ni a
 * cuentas bloqueadas — el ban es justamente "no interactuar con la
 * plataforma").
 *
 * Para `kind: users`, devuelve también los identificadores que no
 * se encontraron — el caller puede mostrarlos como warning.
 */
export async function resolveTargetUserIds(
  target: BroadcastTarget,
): Promise<{ userIds: string[]; notFoundIdentifiers?: string[] }> {
  const notBannedOrBot = and(
    eq(users.isBot, false),
    sql`(${users.bannedUntil} IS NULL OR ${users.bannedUntil} <= now())`,
  );

  if (target.kind === "all") {
    const rows = await db.select({ id: users.id }).from(users).where(notBannedOrBot);
    return { userIds: rows.map((r) => r.id) };
  }

  if (target.kind === "users") {
    const ids = target.identifiers.map((s) => s.trim()).filter((s) => s.length > 0);
    if (ids.length === 0) return { userIds: [], notFoundIdentifiers: [] };
    const idsLower = ids.map((i) => i.toLowerCase());
    const orClause = or(
      inArray(sql<string>`lower(${users.email})`, idsLower),
      inArray(users.username, ids),
    );
    const rows = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(orClause ? and(notBannedOrBot, orClause) : notBannedOrBot);
    const foundLower = new Set<string>();
    for (const r of rows) {
      foundLower.add(r.email.toLowerCase());
      if (r.username) foundLower.add(r.username.toLowerCase());
    }
    const notFound = ids.filter((i) => !foundLower.has(i.toLowerCase()));
    return { userIds: rows.map((r) => r.id), notFoundIdentifiers: notFound };
  }

  if (target.kind === "group") {
    const rows = await db
      .select({ id: users.id })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .where(
        and(
          eq(groupMemberships.groupId, target.groupId),
          isNull(groupMemberships.leftAt),
          notBannedOrBot,
        ),
      );
    return { userIds: rows.map((r) => r.id) };
  }

  // filter
  const conds = [notBannedOrBot];
  if (target.countries && target.countries.length > 0) {
    conds.push(inArray(users.country, target.countries));
  }
  if (target.activeSinceDays) {
    conds.push(
      sql`${users.lastActiveAt} > now() - (${target.activeSinceDays} || ' days')::interval`,
    );
  }
  if (target.topN) {
    // Sub-select top N por puntos. JOIN con user_points.
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userPoints, eq(userPoints.userId, users.id))
      .where(and(...conds))
      .orderBy(desc(userPoints.totalPoints))
      .limit(target.topN);
    return { userIds: rows.map((r) => r.id) };
  }

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(...conds));
  return { userIds: rows.map((r) => r.id) };
}

export type TargetedBroadcastInput = {
  title: string;
  body: string | null;
  target: BroadcastTarget;
};

export type TargetedBroadcastResult = {
  recipients: number;
  notFoundIdentifiers: string[];
};

/**
 * Resuelve el target a la lista final y inserta una notificación
 * por usuario. Kind `admin_broadcast` para que aparezca con el
 * label "Aviso" en la campana — mismo que la notificación
 * individual desde detalle de user.
 */
export async function sendTargetedBroadcast(
  input: TargetedBroadcastInput,
): Promise<TargetedBroadcastResult> {
  const title = input.title.trim();
  const body = input.body?.trim() || null;
  if (title.length === 0) throw new Error("sendTargetedBroadcast: title required");
  if (title.length > 140) throw new Error("sendTargetedBroadcast: title too long");
  if (body && body.length > 500) throw new Error("sendTargetedBroadcast: body too long");

  const { userIds, notFoundIdentifiers = [] } = await resolveTargetUserIds(input.target);
  if (userIds.length === 0) return { recipients: 0, notFoundIdentifiers };

  await db.insert(notifications).values(
    userIds.map((uid) => ({
      userId: uid,
      kind: "admin_broadcast" as const,
      title,
      body,
    })),
  );

  return { recipients: userIds.length, notFoundIdentifiers };
}

/**
 * Helpers que la página broadcast llama para popular los selectores.
 */

export async function listCountriesUsed(): Promise<{ code: string; count: number }[]> {
  const rows = await db
    .select({
      code: users.country,
      count: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(and(eq(users.isBot, false), sql`${users.country} IS NOT NULL`))
    .groupBy(users.country)
    .orderBy(desc(sql`count(*)`));
  return rows.filter((r): r is { code: string; count: number } => r.code !== null).slice(0, 50);
}

export async function listGroupsForBroadcast(): Promise<
  { id: string; name: string; memberCount: number }[]
> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM ${groupMemberships}
        WHERE ${groupMemberships.groupId} = ${groups.id}
          AND ${groupMemberships.leftAt} IS NULL
      )`,
    })
    .from(groups)
    .where(isNull(groups.deletedAt))
    .orderBy(groups.name);
  return rows;
}

/**
 * Estima cuántos users coincidirán con un target SIN insertar
 * notificaciones. Para el preview en la UI antes de pulsar enviar.
 */
export async function estimateTargetRecipients(target: BroadcastTarget): Promise<number> {
  const { userIds } = await resolveTargetUserIds(target);
  return userIds.length;
}
