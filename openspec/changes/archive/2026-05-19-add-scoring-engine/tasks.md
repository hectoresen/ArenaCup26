# Tasks — add-scoring-engine

- [x] 1. `src/server/scoring/rules.ts` con `POINTS`, `COMBO_MILESTONES`, `COMBO_BONUS` (base + modified). Comentarios apuntando a `docs/scoring.md`.
- [x] 2. `src/server/scoring/types.ts` con `MatchOutcome`, `Prediction`, `StreakState`, `ScoreResult`, `ComboBonus`, `PredictionKind`, `PredictionWinner`, `PointEventKind`.
- [x] 3. `src/server/scoring/engine.ts` con `scoreMatchPrediction`, helper `resolveOutcome`, `evaluateHit`, `coverageForDouble`, `computeComboBonuses`. Función pura, sin imports de BD.
- [x] 4. `src/server/scoring/engine.test.ts` exhaustivo (65+ tests) cubriendo todos los caminos del Requirement spec.
- [ ] 5. Smoke check manual: `npm test` pasa todos los tests del engine + los preexistentes (mock, faq-item, rank-row).
- [ ] 6. Promover `specs/scoring-engine/spec.md` a `openspec/specs/scoring-engine/spec.md` y archivar.
- [ ] (deferred) Adapter Drizzle → `MatchOutcome`/`Prediction` cuando aterrice `add-prediction-flow`.
- [ ] (deferred) Pipeline de cierre que invoca el engine para todas las predicciones de un partido y materializa `point_events` + `user_points`.
- [ ] (deferred) Cálculo de bonuses de engagement (encuestas, referidos) en módulo paralelo.
