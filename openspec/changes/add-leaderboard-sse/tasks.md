# Tasks — add-leaderboard-sse

## Bus

- [ ] 1. Setup Redis (Upstash si ya disponible, sino Railway plugin Redis).
- [ ] 2. `src/server/events/bus.ts` con `publish(channel, payload)` + `subscribe(channel, handler)`.
- [ ] 3. Publish hooks en `processFinishedMatch` tras cada user procesado.

## Endpoint SSE

- [ ] 4. `src/app/api/leaderboard/stream/route.ts` con `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
- [ ] 5. Subscribe al canal, escribe events al stream. Cierra cuando el client desconecta.
- [ ] 6. Snapshot inicial al abrir + updates incrementales.
- [ ] 7. Heartbeat cada 30s (`: ping\n\n`) para mantener viva la conexión tras proxy.

## Cliente

- [ ] 8. `useLeaderboardStream(initial)` hook que abre EventSource + aplica updates.
- [ ] 9. `LeaderboardView` consume el hook. Animación de re-orden con CSS / Framer Motion.
- [ ] 10. Reconnect automático tras desconexión (3s, 6s, 12s backoff).
- [ ] 11. Fallback a polling si EventSource no soportado.

## Performance

- [ ] 12. Rate de eventos: máx 1/s por conexión (drop intermedios, mantén último).
- [ ] 13. Cuando user pausa la pestaña, suspender stream y reabrir al volver con snapshot fresh.

## Retirada de polling

- [ ] 14. Borrar `<LiveAutoRefresh>` cuando SSE esté operativo. Update decision §12.5.

## Tests

- [ ] 15. Unit del bus.
- [ ] 16. Integration: postFinished match → consumer recibe score-update.
- [ ] 17. E2E: user puntúa, otro user con pestaña abierta ve actualizado sin refresh.

## Docs

- [ ] 18. `docs/decisions.md` §16 con SSE vs WebSocket (por qué SSE: simpler, no requiere upgrade, unidireccional suficiente).
