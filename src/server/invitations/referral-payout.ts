import { derr, dlog } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import { invitationRedemptions, pointEvents, userPoints } from "@/server/db/schema";
import { createNotification } from "@/server/notifications/create";
import { and, eq, isNull, sql } from "drizzle-orm";

/**
 * Bonus en puntos que recibe el inviter cuando uno de sus invitados
 * acierta por primera vez. Source of truth: `docs/scoring.md` §X
 * ("Un referido acierta su primera predicción → +10 al referidor,
 * one-time por referido").
 */
const REFERRAL_BONUS = 10;

export type ReferralPayoutResult =
  | { paid: false; reason: "not_referred" | "already_paid" }
  | { paid: true; inviterId: string; pointsAwarded: number };

/**
 * Llamado tras procesar el scoring de un user. Si ese user es un
 * invitee (existe redemption suya) y este es su primer hit oficial
 * (`first_hit_at IS NULL`), paga +10 puntos al inviter y desbloquea
 * el logro `better-with-friends`.
 *
 * Atomic guard: el UPDATE setea `first_hit_at = now()` con
 * `WHERE first_hit_at IS NULL` — si dos hits del invitee se procesan
 * concurrentemente, solo uno consigue el RETURNING y paga el bonus.
 * El otro se va por la rama `already_paid`.
 *
 * **Llamar solo cuando el score fue un hit**: el caller decide qué
 * cuenta como hit en su contexto (excluir `miss` / `voided`).
 *
 * No fallible: errores de notificación/logro se loguean y se
 * tragan — el scoring del invitee ya pasó, no queremos abortar
 * por un fallo de la rama de bonus.
 */
export async function payReferralBonusIfFirstHit(
  db: Database,
  inviteeId: string,
  matchId: string,
): Promise<ReferralPayoutResult> {
  // Atomic claim: solo una llamada pasa el WHERE first_hit_at IS NULL.
  const claimed = await db
    .update(invitationRedemptions)
    .set({ firstHitAt: new Date() })
    .where(
      and(eq(invitationRedemptions.inviteeId, inviteeId), isNull(invitationRedemptions.firstHitAt)),
    )
    .returning({ inviterId: invitationRedemptions.inviterId });

  const claim = claimed[0];
  if (!claim) {
    // O bien el user no era invitee (caso normal), o ya se pagó
    // antes (race ganada por otro). En ambos casos no hacemos nada.
    return { paid: false, reason: "already_paid" };
  }

  const inviterId = claim.inviterId;
  // 1) Insertar `point_event` de tipo `referral` para auditoría.
  //    Sin `predictionId` (no aplica) ni `matchId` específico de la
  //    predicción del inviter; matchId queda como "match cuya
  //    finalización disparó el pago" para rastrear el evento.
  try {
    await db.insert(pointEvents).values({
      userId: inviterId,
      matchId,
      kind: "referral",
      points: REFERRAL_BONUS,
    });
  } catch (err) {
    derr("scoring", "referral pointEvent insert failed", { inviterId, err });
  }

  // 2) Acumular en `user_points`. Si el inviter aún no tiene fila
  //    (no debería pero defensivo), creamos la fila a 10.
  try {
    await db
      .insert(userPoints)
      .values({
        userId: inviterId,
        totalPoints: REFERRAL_BONUS,
        streak: 0,
        correctCount: 0,
        streakMax: 0,
        simpleHits: 0,
      })
      .onConflictDoUpdate({
        target: userPoints.userId,
        set: {
          totalPoints: sql`${userPoints.totalPoints} + ${REFERRAL_BONUS}`,
        },
      });
  } catch (err) {
    derr("scoring", "referral user_points update failed", { inviterId, err });
  }

  // 3) Notificación in-app al inviter. Cuando push esté wireado,
  //    esto también disparará un push (igual que otras notis).
  try {
    await createNotification({
      db,
      userId: inviterId,
      kind: "system",
      title: `+${REFERRAL_BONUS} pts: un amigo invitado ha acertado su primera predicción`,
      body: null,
    });
  } catch (err) {
    derr("scoring", "referral notification failed", { inviterId, err });
  }

  dlog("scoring", "referral bonus paid", {
    inviterId,
    inviteeId,
    matchId,
    points: REFERRAL_BONUS,
  });

  return { paid: true, inviterId, pointsAwarded: REFERRAL_BONUS };
}
