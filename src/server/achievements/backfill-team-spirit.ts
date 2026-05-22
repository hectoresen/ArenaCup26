import type { Database } from "@/server/db/client";
import { groupMemberships, groups, userAchievements } from "@/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Backfill idempotente del logro `team-spirit`. Para cada user con
 * ≥1 membership activa en algún grupo no borrado y que NO tenga ya
 * el logro, inserta la fila en `user_achievements`.
 *
 * Necesario porque el gate `ACHIEVEMENTS_MIN_FINISHED_MATCHES` está
 * activo en prod (espera 5 partidos jugados) — el evaluateAndUnlock
 * a la hora de crear/aceptar grupo retornaba [] silenciosamente.
 * Tras el fix del bypass, los nuevos joins funcionan, pero los que
 * ya tenían grupos quedaron sin el logro. Este script los recupera.
 *
 * Lo corremos como parte del pre-deploy en Railway (junto al seed
 * del catálogo). Idempotente: una vez todos los users con grupos
 * ya tienen el logro, no hace nada en deploys sucesivos.
 *
 * Returns: número de users a los que se les desbloqueó.
 *
 * NOTA: NO genera notificaciones in-app ni push — sería spam (un
 * batch enviar 1000 notis en startup). Si el user quiere ver el
 * "logro desbloqueado", lo verá en su perfil tras hard refresh.
 */
export async function backfillTeamSpirit(db: Database): Promise<number> {
  // Users que YA tienen el logro (los excluimos).
  const alreadyHaveRows = await db
    .select({ userId: userAchievements.userId })
    .from(userAchievements)
    .where(eq(userAchievements.achievementId, "team-spirit"));
  const alreadyHave = alreadyHaveRows.map((r) => r.userId);

  // Users con ≥1 membership activa.
  const eligibleRows = await db
    .selectDistinct({ userId: groupMemberships.userId })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(and(isNull(groupMemberships.leftAt), isNull(groups.deletedAt)));
  const toBackfill = eligibleRows.map((r) => r.userId).filter((id) => !alreadyHave.includes(id));

  if (toBackfill.length === 0) return 0;

  // Insert en bulk con onConflictDoNothing (idempotente extra).
  await db
    .insert(userAchievements)
    .values(
      toBackfill.map((userId) => ({
        userId,
        achievementId: "team-spirit",
      })),
    )
    .onConflictDoNothing();

  return toBackfill.length;
}
