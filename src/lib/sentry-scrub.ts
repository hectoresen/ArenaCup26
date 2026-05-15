import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * `beforeSend` hook que elimina PII de los eventos antes de
 * mandarlos a Sentry. Cumple dos objetivos:
 *
 *   1. RGPD: no enviamos email, nombre, predicciones del user.
 *   2. Seguridad: los headers `authorization`, `cookie` y similares
 *      se redactan para que un bug que los logue no exponga tokens.
 *
 * Si el evento no contiene PII, lo deja pasar sin tocar.
 *
 * Devolver `null` desde aquí elimina el evento por completo. Lo
 * usamos solo para errores ya conocidos (e.g. `UntrustedHost` en
 * dev que esperamos durante desarrollo local).
 */
export function scrubPiiBeforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // 1) Drop conocidos no útiles
  const message = event.exception?.values?.[0]?.value ?? event.message ?? "";
  if (typeof message === "string") {
    if (message.includes("UntrustedHost")) return null;
    if (message.includes("ECONNREFUSED")) return null;
  }

  // 2) Scrub headers sensibles en el contexto del request
  if (event.request?.headers) {
    const headers = event.request.headers as Record<string, string>;
    const sensitive = ["authorization", "cookie", "x-cron-secret", "x-api-key"];
    for (const key of Object.keys(headers)) {
      if (sensitive.some((s) => key.toLowerCase().includes(s))) {
        headers[key] = "[Filtered]";
      }
    }
  }

  // 3) Anonimizar user data
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
    // Conservamos `id` para correlacionar eventos de un mismo user
    // sin exponer su identidad pública.
  }

  // 4) Eliminar bodies con predicciones — pueden delatar comportamiento
  //    si se cruzan con el rank público
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("prediction") ||
        lower.includes("password") ||
        lower.includes("token") ||
        lower.includes("secret")
      ) {
        event.extra[key] = "[Filtered]";
      }
    }
  }

  return event;
}
