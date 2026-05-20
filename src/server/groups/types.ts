import type { GroupColor } from "@/server/db/schema";

/**
 * Shapes públicos del dominio de grupos. Los componentes UI y las
 * páginas Next.js consumen estos tipos; las server actions devuelven
 * variantes de ellos. NO se importan tipos crudos de Drizzle en
 * componentes (mantiene la frontera de capas limpia).
 */

export type GroupVisibility = "public" | "private";

export type GroupRole = "admin" | "member";

/**
 * Resumen de un grupo para cards en listings (`/social` "Mis grupos",
 * `/social/grupos/descubrir`). Sin info sensible — no incluye lista
 * de miembros ni invitaciones.
 */
export type GroupSummary = {
  id: string;
  name: string;
  color: GroupColor;
  visibility: GroupVisibility;
  maxMembers: number;
  memberCount: number;
  /** Si el viewer es miembro activo, su rol. `null` si no es miembro. */
  viewerRole: GroupRole | null;
};

/**
 * Detalle completo para `/social/grupos/<id>`. Incluye ranking +
 * membership info del viewer + admin tools si aplica.
 */
export type GroupDetail = GroupSummary & {
  createdAt: Date;
  creatorId: string;
  /** Si el viewer es ex-miembro congelado, true (read-only access). */
  viewerIsFrozen: boolean;
  /** True si el viewer puede acceder a admin tools (= viewerRole === 'admin'). */
  viewerIsAdmin: boolean;
};

/**
 * Una fila del ranking del grupo. Reutiliza el shape del global pero
 * añade `frozen` para que la UI pinte el visual distinto (gris,
 * etiqueta "ex-miembro").
 */
export type GroupRankingEntry = {
  userId: string;
  username: string | null;
  name: string;
  countryCode: string | null;
  avatarId: string | null;
  image: string | null;
  points: number;
  streak: number;
  correctCount: number;
  /** Si true, el user es ex-miembro y `points` son los congelados al `left_at`. */
  frozen: boolean;
  /**
   * `true` si el miembro estuvo activo en las últimas 24h
   * (`users.last_active_at`). Mismo umbral que el ranking global —
   * dispara el puntito verde en `<RankRow>`. Ex-miembros congelados
   * pueden conservar el dot si siguen entrando a la app.
   */
  isOnline: boolean;
  /** Rank within group (1-based). Calculado en query. */
  rank: number;
  /** Delta vs hace 7 días dentro de ESTE grupo. null si no hay historial. */
  rankDelta: number | null;
};

/**
 * Member del grupo para listados internos (admin panel, leave UX).
 * No incluye stats — solo identidad + rol + estado.
 */
export type GroupMemberRow = {
  userId: string;
  username: string | null;
  name: string;
  avatarId: string | null;
  image: string | null;
  role: GroupRole;
  joinedAt: Date;
  leftAt: Date | null;
};

/**
 * Invitación directa para listados en `/social` ("Invitaciones de
 * grupo pendientes").
 */
export type GroupInvitationRow = {
  invitationId: string;
  groupId: string;
  groupName: string;
  groupColor: GroupColor;
  invitedByName: string | null;
  createdAt: Date;
};

/**
 * Link de invitación para el panel admin.
 */
export type GroupLinkRow = {
  linkId: string;
  token: string;
  maxUses: number;
  uses: number;
  revokedAt: Date | null;
  createdAt: Date;
  /** URL completa, derivada del token + NEXT_PUBLIC_APP_URL. */
  url: string;
};

/**
 * Resultado tipado de actions. Patrón consistente con el resto de
 * server actions del proyecto (privacy, friends, invitations).
 */
export type GroupActionResult =
  | { ok: true; groupId?: string }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "invalid_input"
        | "not_found"
        | "already_member"
        | "not_member"
        | "is_admin_cannot_leave"
        | "group_full"
        | "group_deleted"
        | "cap_groups_reached"
        | "cap_links_reached"
        | "link_revoked"
        | "link_exhausted"
        | "invitation_not_pending"
        | "cannot_demote_self"
        | "max_members_below_count";
    };
