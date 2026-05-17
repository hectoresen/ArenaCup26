/* ArenaCup26 — Service Worker para push notifications.
 *
 * Funcionalidad mínima:
 *  - `push` event: parsea el payload JSON y muestra una notificación
 *    con icono, badge, body y URL de destino.
 *  - `notificationclick`: abre la URL del payload (o `/inicio` por
 *    default) y enfoca la pestaña existente si la hay.
 *
 * NO interceptamos `fetch` (no es un PWA con offline-first todavía).
 * Si más adelante queremos modo offline, añadiremos cache strategies
 * aquí mismo.
 */

self.addEventListener("install", (event) => {
  // skipWaiting → la nueva versión del SW se activa inmediatamente
  // sin esperar a que se cierren las pestañas existentes.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Si por algún motivo el server mandó texto plano, lo usamos
    // como title fallback.
    payload = { title: event.data.text() };
  }
  const title = payload.title || "ArenaCup26";
  const options = {
    body: payload.body || "",
    icon: "/pwa-icon.svg",
    badge: "/pwa-icon.svg",
    data: { url: payload.url || "/inicio" },
    // Si llegan dos pushes del mismo tipo, reemplazar — evitar spam.
    tag: payload.tag || "arenacup26-default",
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/inicio";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Si ya hay una pestaña abierta de la app, enfocarla y
        // navegarla al targetUrl (cliente decide si recarga).
        const url = new URL(client.url);
        const target = new URL(targetUrl, self.location.origin);
        if (url.origin === target.origin && "focus" in client) {
          client.navigate(target.href);
          return client.focus();
        }
      }
      // Sin pestañas abiertas → abrir una nueva.
      return self.clients.openWindow(targetUrl);
    }),
  );
});
