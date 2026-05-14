# add-leaderboard-sse

## Why

Hoy:
- `/inicio` refresca cada 30s con `router.refresh()` solo si hay live match (decisión 12.5).
- `/ranking` no refresca — el user lo abre y ve un snapshot SSR del momento.
- Cron de api-football corre cada 3h.

Resultado: cuando un partido termina, el scoring puede tardar hasta 3h en correr, y el ranking del navegador del user puede tardar otros minutos en reflejarlo. Para una app "social y competitiva en vivo" no es suficiente.

## What changes

Capability nueva: **`leaderboard-sse`**.

### Push real con Server-Sent Events

`GET /api/leaderboard/stream` — endpoint que mantiene una conexión SSE abierta y emite eventos:

```
event: snapshot
data: { generatedAt, players: [...] }

event: score-update
data: { userId, pointsDelta, newRank }
```

### Bus

- **Redis pub/sub** (Upstash si ya está por `add-rate-limiting`, sino Railway Redis).
- Canal `wm:leaderboard`.
- `processFinishedMatch` publica un `score-update` por cada `point_events` insertado.

### Cliente

`src/components/leaderboard/leaderboard-view.tsx` se vuelve "use client" reactivo:
- Recibe `initialSnapshot` por SSR (como ya hace).
- Abre `EventSource('/api/leaderboard/stream')` post-mount.
- Aplica updates al state local.
- Animación de re-orden con Framer Motion (CSS `transform` para evitar re-layout completo).

### Backpressure

- Si un usuario tiene la pestaña en background, no enviamos heartbeat; al volver, full snapshot.
- Límite de 1 evento/s por conexión.

### Fallback

- Si SSE no soportado (raro), polling cada 30s como hoy.
- Si Redis no disponible (env vars vacías) → polling.

## Impact

- **Coste**: Redis Upstash o Railway Redis. Si ya está montado por `add-rate-limiting`, coste marginal cero.
- **Riesgo**: keep-alive de SSE en Railway. Plataforma sí soporta long-lived connections (verificado en docs).
- **Bloquea**: nada.
- **Desbloquea**: experiencia "live" real. También elimina el polling de 30s de `<LiveAutoRefresh>` (se sustituye).
