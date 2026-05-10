# Tasks — add-match-data-providers (round a)

- [x] 1. `src/server/match-data/types.ts` con `ProviderMatch`, `ProviderMatchStatus`, `MatchDataProvider`, `ProviderError`, `ProviderErrorCode`.
- [x] 2. `src/server/match-data/providers/api-football.parser.ts` con `parseApiFootballFixture`, `parseStage`, mapeo exhaustivo de status codes y cálculo correcto de `scoreAtExtra` (cumulativo de fulltime + extratime).
- [x] 3. `src/server/match-data/providers/api-football.fixtures.ts` con 7 fixtures sintéticos + el shape real de la final WC 2022 (capturado en sandbox).
- [x] 4. `src/server/match-data/providers/api-football.parser.test.ts` con tests del parser (parseStage, cada status, cada combinación de scores).
- [x] 5. `src/server/match-data/providers/api-football.ts` con `createApiFootballProvider`, manejo de errors del envelope, mapeo HTTP status → `ProviderErrorCode`, soporte para `fetcher` inyectado.
- [x] 6. `src/server/match-data/providers/api-football.test.ts` con tests del provider mediante fetch mockeado (URL, headers, errors, network failures).
- [x] 7. `src/server/match-data/providers/api-football.integration.test.ts` con `describe.skipIf(!process.env.API_FOOTBALL_KEY)` golpeando WC 2022 real.
- [x] 8. `src/server/match-data/adapter.ts` con `toMatchOutcome` y mapeo `ProviderMatchStatus → MatchStatus`.
- [x] 9. `src/server/match-data/adapter.test.ts` con tests del adapter + tests end-to-end del scoring engine sobre el shape real de la final.
- [ ] 10. Smoke check: `npm test` pasa todos los tests offline (parser + provider mocked + adapter); con `API_FOOTBALL_KEY` en env corre también el de integración.
- [ ] 11. Promover `specs/match-data-providers/spec.md` a `openspec/specs/match-data-providers/spec.md` y archivar.
- [ ] (deferred) `add-match-data-pipeline`: cron + persistencia + team mapping → `matches` en BD.
- [ ] (deferred) `add-match-data-providers-livescore`: añadir `LiveScoreApiProvider` y `FailoverProvider` (round b).
- [ ] (deferred) `add-match-data-resilience`: retries con backoff, circuit breaker, caching de fixture metadata.
- [ ] (deferred) `getLiveFixtures` y `getFixtureEvents` en la interfaz `MatchDataProvider` (vienen con `add-leaderboard-sse`).
