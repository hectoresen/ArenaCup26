# Tasks — add-edge-case-fixtures

- [x] 1. `src/server/scoring/edge-cases.fixtures.ts` con 17 fixtures cubriendo grupos, eliminatoria, anulados y combos.
- [x] 2. Tipo `ScoringFixture` exportado para que un futuro generador o seed pueda construir fixtures de la misma forma.
- [x] 3. `src/server/scoring/edge-cases.test.ts` con `it.each` y sanity checks (longitud mínima, IDs únicos, cobertura de stages y kinds).
- [ ] 4. Smoke check manual: `npm test` corre los 17 fixtures + sanity checks.
- [ ] 5. Promover `specs/edge-case-fixtures/spec.md` a `openspec/specs/edge-case-fixtures/spec.md` y archivar.
- [ ] (deferred) Property-based fixtures con `fast-check` para superficies complejas (combos en racha larga, ordenación de eventos).
- [ ] (deferred) Fixtures de partidos reales del Mundial 2022 (vienen con `add-fixture-seed-wc2022`).
