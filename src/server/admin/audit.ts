import { db } from "@/server/db/client";
import { adminAuditLog, users } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * Tipos de acción que dejan rastro en `admin_audit_log`. Centralizar
 * el set evita typos cuando se filtra el feed o se cuentan acciones
 * por tipo. Append-only: añadir, nunca renombrar.
 */
export type AdminAction =
  | "maintenance_toggle"
  | "broadcast_sent"
  | "user_banned"
  | "user_unbanned"
  | "points_adjusted"
  | "tournament_reset";

export type LogAdminActionInput = {
  adminUserId: string;
  action: AdminAction;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
};

/**
 * Registra una acción admin en `admin_audit_log`. Llamar desde cada
 * server action admin tras el éxito (no en pre-conditions). Si el
 * insert falla, propagamos el error: el caller decide si el rollback
 * incluye la acción original o solo aborta el log.
 */
export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  await db.insert(adminAuditLog).values({
    adminUserId: input.adminUserId,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    payload: input.payload ?? null,
  });
}

export type AuditEntry = {
  id: string;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: unknown;
  createdAt: Date;
};

/**
 * Últimas N acciones admin con el email del actor resuelto (para
 * mostrar en el dashboard sin tener que joinear en cada vista).
 */
export async function getRecentAdminActions(limit = 20): Promise<AuditEntry[]> {
  const rows = await db
    .select({
      id: adminAuditLog.id,
      adminEmail: users.email,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      payload: adminAuditLog.payload,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(adminAuditLog.adminUserId, users.id))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);

  return rows;
}
