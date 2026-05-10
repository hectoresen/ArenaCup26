# Tasks — add-fixture-seed-wc2022

- [x] 1. `src/server/seeds/wc2022/teams.ts` con 32 selecciones, FIFA codes, group A-H.
- [x] 2. `src/server/seeds/wc2022/matches.ts` con 24 partidos (16 knockout + 8 group representativos) y resultados oficiales.
- [x] 3. `src/server/seeds/wc2022/seed.ts` con `seedWC2022(db)`: truncate + upsert teams + insert matches.
- [x] 4. `scripts/seed-wc2022.ts` entrypoint CLI con warning de destructividad.
- [x] 5. `package.json`: script `seed:wc2022`.
- [x] 6. `src/server/seeds/wc2022/seed.test.ts` con 15 tests (teams shape, matches shape + iconic cases, integración con scoring engine).
- [ ] 7. Smoke check: `npm run seed:wc2022` con Postgres limpio → log "Inserted 32 teams and 24 matches."
- [ ] 8. Smoke check: `npm test` corre los 15 tests.
- [ ] 9. Promover `specs/fixture-seed-wc2022/spec.md` a `openspec/specs/fixture-seed-wc2022/spec.md` y archivar.
- [ ] (deferred) `update-wc2022-group-completion`: completar los 40 partidos restantes de la fase de grupos.
- [ ] (deferred) Mecanismo de "replay" que dispara eventos en vivo simulados a partir del fixture, para validar `add-leaderboard-sse` en staging.
- [ ] (deferred) Localización de nombres de equipos en `messages/{locale}.json` cuando aterrice la UI de fixture.
