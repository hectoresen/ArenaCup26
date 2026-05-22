import { dlog } from "@/lib/debug-log";
import { env } from "@/lib/env";
import webpush from "web-push";

/**
 * Inicializa el cliente web-push con los VAPID keys del entorno. Si
 * cualquier key falta, devuelve `null` y el caller debe tratar el
 * push como noop. Idempotente: se llama tantas veces como sea
 * necesario, internamente la lib mantiene los detalles globalmente.
 *
 * Genera VAPID keys con `npx web-push generate-vapid-keys`. La
 * pública va en `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (visible al browser
 * para suscribirse); la privada en `VAPID_PRIVATE_KEY` (server-only,
 * firma los pushes).
 */
export function getPushClient(): typeof webpush | null {
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    // Falta VAPID_SUBJECT también: los providers (FCM/Mozilla) lo
    // exigen como contacto del operador del push service. Mientras
    // no haya un canal de contacto público, el sistema queda en
    // noop a propósito (mejor que filtrar un correo personal).
    return null;
  }
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  return webpush;
}

export type PushPayload = {
  /** Título de la notificación (max ~50 chars). */
  title: string;
  /** Body opcional (max ~120 chars). */
  body?: string;
  /** URL relativa a la que navegar al hacer click. Default `/`. */
  url?: string;
};

/** Códigos de fallo no fatales que el caller puede tolerar. */
export type SendPushError =
  | { kind: "not_configured" }
  | { kind: "gone"; endpoint: string }
  | { kind: "transient"; message: string };

/**
 * Envía un payload push a un endpoint concreto. Devuelve `null` si
 * fue OK; si falla, devuelve un objeto tipado con el motivo.
 *
 * - `not_configured`: VAPID keys ausentes. Caller debe abortar el
 *   loop sin tirar más envíos.
 * - `gone`: 404/410 — la subscripción ya no es válida (browser la
 *   revocó o cambió). Caller debe borrar la fila en BD.
 * - `transient`: cualquier otro error. Caller puede reintentar más
 *   tarde o loggear.
 */
export async function sendPushTo(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<SendPushError | null> {
  const client = getPushClient();
  if (!client) return { kind: "not_configured" };

  try {
    await client.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 }, // 24h: si el device no se conecta en ese plazo, descartar.
    );
    return null;
  } catch (err) {
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode: number }).statusCode
        : 0;
    if (status === 404 || status === 410) {
      dlog("push", "subscription gone, will be cleaned up", { endpoint: subscription.endpoint });
      return { kind: "gone", endpoint: subscription.endpoint };
    }
    const message = err instanceof Error ? err.message : String(err);
    dlog("push", "transient push error", { status, message });
    return { kind: "transient", message };
  }
}
