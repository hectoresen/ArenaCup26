"use client";

import { subscribePush, unsubscribePush } from "@/server/push/actions";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

type Props = {
  /** Clave pública VAPID — pasada al hook desde el server.
   * Si está vacía, el componente no se renderiza. */
  vapidPublicKey: string;
};

type SubState = "idle" | "denied" | "subscribed" | "unsupported";

/**
 * Toggle de opt-in a push notifications. Server-component pasa la
 * VAPID public key; si está vacía (no configurada), no se monta nada.
 * Sin esto el banner sería un "click → fallo silencioso" que confunde.
 *
 * Flujo:
 *  1. Mount → detecta estado actual:
 *     - `Notification` no existe → unsupported.
 *     - `Notification.permission === 'denied'` → denied (no se puede
 *       pedir de nuevo, hay que ir a settings del navegador).
 *     - Hay un PushSubscription en el registro SW → subscribed.
 *     - Default → idle (mostrar botón "Activar").
 *  2. Click activar → registra SW + pide permission + suscribe →
 *     subscribePush(action) persiste en BD.
 *  3. Click desactivar → unsubscribe en navegador + unsubscribePush.
 */
export function PushOptIn({ vapidPublicKey }: Props) {
  const t = useTranslations("push.optIn");
  const [state, setState] = useState<SubState>("idle");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    // Comprobar si ya hay una suscripción activa.
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) {
        setState("idle");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "idle");
    });
  }, []);

  function activate() {
    startTransition(async () => {
      try {
        // Registrar SW si no lo está.
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Pedir permission. Si el user lo deniega aquí, no podemos
        // re-preguntar — hay que ir a settings del navegador.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "idle");
          return;
        }

        // Suscribir al push service del browser (FCM/Mozilla/etc).
        // El cast a BufferSource es para satisfacer el tipo del DOM
        // — Uint8Array es válido en runtime pero TS lib.dom.d.ts a
        // veces lo rechaza por ArrayBufferLike vs ArrayBuffer.
        const key = urlBase64ToUint8Array(vapidPublicKey);
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        });

        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          // Browser devolvió subscripción sin keys — caso raro, salir.
          await sub.unsubscribe();
          setState("idle");
          return;
        }
        const result = await subscribePush({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        });
        setState(result.ok ? "subscribed" : "idle");
      } catch {
        setState("idle");
      }
    });
  }

  function deactivate() {
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await unsubscribePush(endpoint);
      }
      setState("idle");
    });
  }

  if (state === "unsupported") return null;

  return (
    <section className="rounded-2xl border-2 border-border bg-card p-4">
      <header className="mb-2 flex items-center gap-2">
        <span aria-hidden="true" className="text-base leading-none">
          🔔
        </span>
        <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-gold">
          {t("title")}
        </h2>
      </header>
      <p className="mb-3 text-[12px] font-bold leading-snug text-muted">{t("body")}</p>
      {state === "denied" && <p className="text-[12px] font-extrabold text-warm">{t("denied")}</p>}
      {state === "idle" && (
        <button
          type="button"
          onClick={activate}
          disabled={isPending}
          className="cursor-pointer rounded-xl border-2 border-gold/40 bg-gold/10 px-4 py-2 text-sm font-extrabold text-gold transition-colors hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? t("activating") : t("activate")}
        </button>
      )}
      {state === "subscribed" && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-extrabold text-success">✓ {t("active")}</span>
          <button
            type="button"
            onClick={deactivate}
            disabled={isPending}
            className="cursor-pointer rounded-xl border-2 border-border bg-card-hover px-3 py-1.5 text-[12px] font-extrabold text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("deactivate")}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Convierte la VAPID public key (base64url) al Uint8Array que
 * `pushManager.subscribe()` exige. La función está documentada en la
 * spec del Push API; copiar-pegar es estándar.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
