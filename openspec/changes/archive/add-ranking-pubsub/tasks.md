# Tasks — add-ranking-pubsub

## 1 · Investigación

- [ ] Verificar que Upstash Redis REST soporta `PUBLISH`/`SUBSCRIBE` o
      equivalente. Si NO → decidir alternativa (Streams, polling de
      key, otro vendor).
- [ ] Medir latencia E2E actual con instrumentación temporal
      (timestamps en cada paso del pipeline) para tener baseline.

## 2 · Implementación

- [ ] `src/lib/redis/pubsub.ts`: cliente publish/subscribe wrapper
      sobre Upstash. Si subscribe no es soportado, implementar
      polling de un key con TTL.
- [ ] `src/server/scoring/pipeline.ts`: al final de
      `processFinishedMatch`, publicar evento `ranking-changed` con
      `{ at, matchId, source: 'finished' }`.
- [ ] `src/app/api/cron/snapshot-ranking/route.ts`: también publica
      tras el snapshot diario para que los clients vean el cambio
      de delta semanal.
- [ ] `src/app/api/leaderboard/stream/route.ts`:
  - Subscribe al canal en `start()`.
  - Al recibir evento → llamar a `sendSnapshot()` inmediatamente.
  - Mantener `tickInterval` 15s como fallback.
  - Unsubscribe en `cancel()` y abort.

## 3 · Tests

- [ ] Unit test del wrapper redis pubsub.
- [ ] Integration test del publisher: verificar que
      `processFinishedMatch` invoca al wrapper con el payload correcto.
- [ ] Integration test del subscriber: simular evento, verificar que
      el SSE emite `snapshot` antes del próximo tick periódico.

## 4 · Ops

- [ ] Monitor de errores del subscriber (Sentry breadcrumb).
- [ ] Doc: añadir sección "Realtime: pub/sub Redis" a
      `docs/data-pipeline.md`.
- [ ] Rollback plan: la subscripción es additive; si rompe, deshabilitar
      por env var `RANKING_PUBSUB_ENABLED=false`.

## 5 · Lanzamiento

- [ ] Deploy con flag OFF.
- [ ] QA: confirmar que tick periódico sigue funcionando.
- [ ] Flag ON en staging (cuando exista) o canary % de tráfico.
- [ ] Flag ON 100% si OK.
