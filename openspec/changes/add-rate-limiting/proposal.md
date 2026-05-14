# add-rate-limiting

## Why

Sin rate limit en signup, submit de predicciones, y endpoints públicos del leaderboard, un atacante o bot puede:

- **Crear miles de cuentas** con Google OAuth (cada `User-Agent` con cookies fresh) y saturar el leaderboard.
- **Hacer DoS al endpoint público del leaderboard** (landing) — cada visita es 1 query a `userPoints` con JOIN a `users`.
- **Spammear submits de predicción** desde una sesión válida, generando ruido en `predictions` y notificaciones.
- **Disparar manualmente** el cron de api-football desde dispositivos distintos antes de que llegue el bearer (combina con `add-security-hardening`).

Hoy no hay defensa. Una herramienta cualquiera con curl tumba el cupo de la API o llena la BD.

## What changes

Capability nueva: **`rate-limiting`**.

### Backend: Upstash Ratelimit

`src/lib/rate-limit.ts`:

- Cliente con `@upstash/ratelimit` + `@upstash/redis` (free tier 10k requests/día — suficiente para esta fase).
- Helpers tipados:
  - `submitPredictionLimiter`: sliding window, 10 req / 60s por `userId`.
  - `cronLimiter`: 1 req / 10s por IP (defensa contra script tonto, no contra atacante con bearer).
  - `publicReadLimiter`: 30 req / 60s por IP para `/` y `/u/<username>`.
  - `signupLimiter`: 3 req / hora por IP — el signup real lo hace Auth.js callback, así que el wrapper va antes del callback.

### Wiring

- `src/server/predictions/submit.ts`: primera línea del handler `await submitPredictionLimiter.check(userId)`. Si rebasa, devuelve `{ok:false, code:"rate_limited"}`.
- `src/app/api/cron/sync-fixtures/route.ts`: tras superar auth, `await cronLimiter.check(ip)`. 429 si rebasa.
- `src/app/[locale]/page.tsx` y `src/app/[locale]/u/[username]/page.tsx`: middleware `publicReadLimiter`. 429 si rebasa (con página estática "Demasiadas requests").
- `src/middleware.ts`: extender para que `POST /api/auth/callback/google` pase por `signupLimiter` (`Cache-Control: no-cache`).

### Env vars

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Si están vacías → noop (todos los limiters dejan pasar). Útil para dev local sin Upstash.

### Logs

Cada 429 emite `[WM/ratelimit]` con scope + identificador truncado (`userId.slice(0, 8)` o `ip.slice(0, 7)`).

## Impact

- **Coste**: Upstash free tier (10k req/día). Si crece la app, ~10€/mes plan Pro.
- **UX**: 429 con mensaje friendly en submit: "Estás predeciendo muy rápido, espera unos segundos". Página estática para reads excesivos.
- **Riesgo**: limiter falso positivo si un usuario legítimo está en una red NAT compartida. Mitigación: para reads usar IP + cookie de sesión (si está), no solo IP.
- **Bloquea**: nada.
- **Desbloquea**: requisito para abrir la app a usuarios externos.
