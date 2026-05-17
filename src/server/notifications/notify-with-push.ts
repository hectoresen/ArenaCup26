import { dlog, derr } from "@/lib/debug-log";
import type { Database } from "@/server/db/client";
import {
  deletePushSubscriptionByEndpoint,
  getUserPushSubscriptions,
} from "@/server/push/queries";
import { sendPushTo } from "@/server/push/client";
import { createNotification, type CreateNotificationInput } from "./create";
import { resolveNotificationHref } from "./href";

export type NotifyInput = Omit<CreateNotificationInput, "db"> & {
  /**
   * Si `true`, también envía web push a todas las subscriptions del
   * user (cuando push está configurado y el user dio opt-in). Por
   * defecto `false` para evitar spam — las notificaciones de
   * sistema o predicciones triviales no merecen un push.
   *
   * El push se envía en paralelo con `Promise.allSettled` para que
   * un destino lento no bloquee el resto. Errores se loguean y se
   * tragan; el contrato externo del helper sigue siendo el mismo
   * que `createNotification` (devuelve el id de la fila in-app).
   */
  pushable?: boolean;
};

/**
 * Crea una notificación in-app + (opcionalmente) la replica como
 * push a todas las subscriptions del user.
 *
 * - **Fila in-app**: siempre se crea (es el contrato base). El
 *   campo `body` se usa también como cuerpo del push.
 * - **URL del push**: derivada con `resolveNotificationHref()` para
 *   que coincida con el destino al que navega la campana al hacer
 *   click. Si la regla devuelve `null`, el push usa `/inicio` como
 *   fallback (no debería ser alcanzable para los kinds pushables).
 * - **Subscriptions `gone`**: si un endpoint devuelve 404/410, lo
 *   borramos de la BD para que el siguiente envío no lo intente
 *   otra vez.
 * - **Sin VAPID**: si los VAPID keys no están seteados, el push
 *   se omite silenciosamente — la fila in-app sigue ahí y la
 *   campana funciona.
 */
export async function notifyWithPush(
  input: NotifyInput & { db: Database },
): Promise<{ id: string }> {
  const { pushable, db, ...createInput } = input;
  const created = await createNotification({ db, ...createInput });

  if (!pushable) return created;

  // Fire-and-await: cargamos subscriptions e intentamos enviar a
  // todas en paralelo. Un user típico tiene 1-3 (móvil + desktop).
  // Si push no está configurado a nivel de server (sin VAPID),
  // `sendPushTo` devolverá `not_configured` en la primera llamada
  // y abortamos el resto para no gastar ciclos.
  let subscriptions: Awaited<ReturnType<typeof getUserPushSubscriptions>>;
  try {
    subscriptions = await getUserPushSubscriptions(db, input.userId);
  } catch (err) {
    derr("push", "failed to load subscriptions", {
      userId: input.userId,
      err: err instanceof Error ? err.message : String(err),
    });
    return created;
  }
  if (subscriptions.length === 0) return created;

  // URL de destino: misma que la campana usaría al hacer click.
  // Para kinds sin destino (`system`), no enviamos push.
  const url = resolveNotificationHref({
    id: created.id,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    matchId: input.matchId ?? null,
    achievementId: input.achievementId ?? null,
    readAt: null,
    createdAt: new Date(),
  });
  if (!url) return created;

  const payload = {
    title: input.title,
    body: input.body ?? undefined,
    url,
    // `tag` agrupa pushes del mismo tipo en el mismo device — si
    // llegan dos solicitudes seguidas, la nueva reemplaza a la
    // antigua en lugar de apilar. Distinto por kind para que
    // friend_request no pise un achievement_unlocked.
    tag: `arenacup26-${input.kind}`,
  };

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendPushTo(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      ),
    ),
  );

  // Cleanup pasivo de subscriptions inválidas. Hacemos los delete
  // en paralelo también — si fallan, no es crítico (el siguiente
  // envío se topará con el mismo 410 y volverá a intentar borrar).
  const goneEndpoints: string[] = [];
  let notConfigured = false;
  for (const [i, result] of results.entries()) {
    if (result.status !== "fulfilled" || result.value === null) continue;
    const err = result.value;
    if (err.kind === "gone") {
      goneEndpoints.push(err.endpoint);
    } else if (err.kind === "not_configured") {
      notConfigured = true;
      break;
    }
  }
  if (goneEndpoints.length > 0) {
    await Promise.allSettled(
      goneEndpoints.map((ep) => deletePushSubscriptionByEndpoint(db, ep)),
    );
    dlog("push", "removed gone subscriptions", {
      userId: input.userId,
      count: goneEndpoints.length,
    });
  }
  if (notConfigured) {
    dlog("push", "push not configured — skipping further sends", {
      userId: input.userId,
    });
  } else {
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value === null,
    ).length;
    if (successCount > 0) {
      dlog("push", "push sent", {
        userId: input.userId,
        kind: input.kind,
        delivered: successCount,
        skipped: subscriptions.length - successCount,
      });
    }
  }

  return created;
}
