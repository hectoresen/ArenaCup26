# Tasks — add-match-data-pipeline

- [ ] 1. Schema delta: añadir `team_external_ids` y `match_external_ids` a `src/server/db/schema.ts` con relations.
- [ ] 2. Generar migración Drizzle vía `drizzle-kit generate`.
- [ ] 3. `src/server/match-data/sync/types.ts` con `MatchPatch`, `MatchRow`, `SyncReport`, `MatchRepo`, `ReconcileResult`.
- [ ] 4. `src/server/match-data/sync/status.ts` con `providerToDbStatus(ProviderMatchStatus) → matchStatus` puro.
- [ ] 5. `src/server/match-data/sync/reconcile.ts` con `reconcileMatch(current, snapshot, teamMap)` — pure function.
- [ ] 6. `src/server/match-data/sync/reconcile.test.ts` con ≥20 casos.
- [ ] 7. `src/server/match-data/sync/team-mapping.ts` con `loadTeamMap`, `loadMatchMap` (lectura ligera).
- [ ] 8. `src/server/match-data/sync/sync.ts` con `syncFixtures({ db, provider, leagueId, season }) → SyncReport`.
- [ ] 9. `src/server/match-data/sync/sync.test.ts` con `MatchRepo` stub: nueva, update, skip, error en uno no aborta lote.
- [ ] 10. `src/server/match-data/sync/sync.integration.test.ts` con `describe.skipIf(!process.env.DATABASE_URL_TEST)`.
- [ ] 11. `src/app/api/cron/sync-fixtures/route.ts` con auth `Bearer ${CRON_SECRET}`.
- [ ] 12. `vercel.json` con cron `*/5 * * * *` apuntando al endpoint.
- [ ] 13. Variable `CRON_SECRET` en `.env.example` y validación en `src/lib/env.ts`.
- [ ] 14. Promover spec a `openspec/specs/match-data-pipeline/spec.md` y archivar.
- [ ] (deferred) `add-scoring-pipeline`: re-calcular puntos cuando `matches` cambia.
- [ ] (deferred) `add-fixture-seed-wc2026`: siembra teams 2026 + entries de `team_external_ids` para los 48 equipos.
