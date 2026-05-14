# add-web-push-notifications

## Why

Hoy las notificaciones solo aparecen en la campana del shell — el usuario tiene que abrir la app para verlas. Para una webapp competitiva con eventos puntuales (partido empezando, predicción cerrada, partido acabado con resultado), la retención cae si no recibes señal fuera de la app.

## What changes

Capability nueva: **`web-push-notifications`**.

### Web Push API + Service Worker

- `public/sw.js` registra `push` y `notificationclick`.
- Service worker minimal: solo recibe push, no cachea (PWA full sería propuesta aparte).

### Schema

`push_subscriptions` nueva tabla:
- `id uuid pk`.
- `user_id uuid fk users.id cascade`.
- `endpoint text unique not null` (URL de Mozilla/Google push service).
- `p256dh_key text not null`, `auth_key text not null`.
- `created_at timestamp default now()`.

### Server

- `npm install web-push`.
- `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` env vars (generadas una vez con `npx web-push generate-vapid-keys`).
- `sendPush(userId, payload)` con fallback graceful si endpoint devuelve 410 (subscription gone) → DELETE de la row.

### Wiring

- Tras un user submit primer login → modal "¿Quieres notificaciones cuando un partido empiece o acabe?".
- Si acepta, navegador pide permiso, registra subscription, POST a `/api/push/subscribe`.
- `processFinishedMatch` → tras crear notification in-app, llama `sendPush(userId, { title: matchup, body: '+30 pts 💎' })` en paralelo.
- Próximos disparadores: `prediction_locked` (kickoff → 30 min), `match_starting` (kickoff).

### UI

- `/ajustes/notificaciones` con switches por tipo (match_finished, achievement_unlocked, match_starting). Estado en BD: nueva tabla `notification_preferences` o cols JSONB en users.
- Banner discreto "Activa notificaciones para no perderte..." en `/inicio` los primeros días para usuarios sin subscription.

## Impact

- **iOS**: web push requiere iOS 16.4+ y la app instalada como PWA. Asume penetración suficiente o documenta limitación.
- **Coste**: 0€ (Mozilla/Google push services gratis).
- **Riesgo**: spam si mandamos demasiadas. Mitigación: defaults conservadores (solo match_finished y achievement_unlocked).
- **Bloquea**: nada.
- **Desbloquea**: retención fuera de la app.
