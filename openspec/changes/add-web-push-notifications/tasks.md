# Tasks — add-web-push-notifications

## Setup

- [ ] 1. `npm install web-push @types/web-push`.
- [ ] 2. `npx web-push generate-vapid-keys` → guardar pub/priv en Railway + .env.example.
- [ ] 3. Schema: `push_subscriptions` table + migración.

## Service worker

- [ ] 4. `public/sw.js` mínimo: `addEventListener('push', e => showNotification(...))` + `notificationclick` que abre la URL.
- [ ] 5. Registrar SW desde un componente cliente cuando el user accede a /inicio onboarded.

## API

- [ ] 6. `POST /api/push/subscribe` recibe `{endpoint, keys: {p256dh, auth}}` y persiste.
- [ ] 7. `POST /api/push/unsubscribe` borra row por endpoint.

## Server `sendPush`

- [ ] 8. `src/server/push/send.ts`: usa `web-push` con VAPID keys. Captura 410 → cleanup.

## Wiring

- [ ] 9. `processFinishedMatch` llama `sendPush` en paralelo a `createNotification`.
- [ ] 10. Hook próximo en `add-match-data-windowed-cron`: detectar transición a `prediction-locked` y enviar push.

## UI

- [ ] 11. Modal "Activar notificaciones" tras onboarding + opción saltar.
- [ ] 12. `/ajustes/notificaciones` con switches por tipo.
- [ ] 13. Banner discreto "Activa notificaciones" en /inicio para users sin sub (descartable, máx 3 veces).

## Tests

- [ ] 14. Mock `web-push` en tests; verificar payload correcto.
- [ ] 15. Test 410 → cleanup de la row.
- [ ] 16. E2E manual: subscribe + emit + ver notif (no automatizable easily).

## Docs

- [ ] 17. `docs/decisions.md` §17 con limitación iOS y plan de PWA.
