# add-ranking-pubsub — Ranking en vivo event-driven con Redis pub/sub

## Why

Hoy el SSE de `/api/leaderboard/stream` emite un snapshot cada **15s** consultando
BD. Combinado con el cron de live-scoring (cada 2 min) y el delay del provider
(~15-20s), la latencia visible de un gol → ranking actualizado en el navegador
ronda **2-3 minutos peor caso**.

Para el Mundial queremos sub-segundo en frontend tras detectar el cambio
en BD. Redis ya está aprovisionado en Railway (Upstash, usado por
rate-limiting) y aceptaría carga de pub/sub sin coste extra.

## What changes

1. **Publisher**: `processFinishedMatch` y cualquier otro punto que actualice
   `user_points` publica en canal Redis `arenacup26:ranking-changed` con
   payload mínimo `{ at: ISO_string }`. Sin payload completo — los suscriptores
   tiran un fetch fresco del snapshot.
2. **Subscriber**: el SSE stream se suscribe al canal en `start()` y emite
   `snapshot` inmediato al recibir cualquier evento. Mantenemos el tick
   periódico (15s) como fallback por si Redis se cae o pierde un evento.
3. **Cleanup**: al `cancel` o `abort` del stream, unsuscribe del canal.
   Upstash maneja la conexión Redis en serverless con HTTP/REST en vez de
   TCP nativo — encaja con Next runtime.

## Impact

- **Affected code**: `src/app/api/leaderboard/stream/route.ts`,
  `src/server/scoring/pipeline.ts` (publicador), `src/lib/redis/pubsub.ts`
  (nuevo).
- **Affected envs**: ya existe `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
- **Affected tests**: test del publicador, test del subscriber con mock Redis.
- **Riesgo**: Upstash REST API NO soporta pub/sub clásico — usa "Streams"
  o polling de claves. Revisar la documentación antes de implementar.
  Alternativa: usar `EX` con `setex` + polling del key cada N segundos
  (no es pub/sub real, pero sí más rápido que 15s).
- **Backwards-compat**: el SSE actual sigue funcionando sin pub/sub. La
  implementación es additive — si Redis falla, fallback al tick periódico.

## Notas

- Sportmonks ofrece Pusher en algunos planes; si llegamos a ese vendor,
  el publisher pasaría a ser el provider directamente y nos quitaríamos
  esta capa intermedia. Por ahora, pub/sub propio.
- Si Upstash REST no soporta pub/sub, opciones:
  1. Cambiar a Upstash Redis con conexión TCP (deprecated por ellos).
  2. Usar otro provider con WS/SSE nativo (Ably, Pusher).
  3. Polling con `setex` reducido a 2-3s (degradación aceptable vs hoy).
- Tareas detalladas en `tasks.md`.
