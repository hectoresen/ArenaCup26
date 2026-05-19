# Tasks — add-ranking-history

## Schema

- [ ] 1. Migración drizzle: `ranking_snapshots` con cols + índice.
- [ ] 2. `src/server/ranking/snapshot.ts` con `captureSnapshot(db)`.

## Cron

- [ ] 3. `.github/workflows/ranking-snapshot.yml` con `cron: "0 3 * * *"`.
- [ ] 4. `/api/cron/ranking-snapshot` endpoint con bearer auth.
- [ ] 5. Retention: borrar snapshots > 90 días.

## Queries

- [ ] 6. `getPointsDelta(userId, days)` con SQL: punto actual - punto snapshot más cercano a now() - days.
- [ ] 7. `getRankDelta(userId, days)`.
- [ ] 8. `getSparkline(userId, days)` que devuelve array.

## Wiring

- [ ] 9. `getDashboardData` retorna delta + sparkline.
- [ ] 10. `getPublicProfile` retorna delta.
- [ ] 11. `getRealSnapshot` usa snapshot de hace 24h para `previousRank`.

## UI

- [ ] 12. `<RankProgressCard>` sustituye placeholder por sparkline real (CSS sparkline o SVG inline).
- [ ] 13. `<StatsRow>` del perfil público muestra ▲ +120 si delta > 0.
- [ ] 14. `<RankRow>` y `<PodiumCard>` ya soportan delta (lógica `arrow()`) — solo se activa al tener datos.

## Tests

- [ ] 15. Unit de cada query con fixtures temporales.
- [ ] 16. Test del cron handler.

## Docs

- [ ] 17. `docs/decisions.md` §18 con la decisión de daily snapshot vs continuous.
