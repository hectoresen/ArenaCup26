# Tasks — add-round-of-32-stage

- [ ] 1. Migration Drizzle: añadir `'round-of-32'` al pgEnum `match_stage` (`ALTER TYPE match_stage ADD VALUE IF NOT EXISTS 'round-of-32' BEFORE 'round-of-16'`).
- [ ] 2. Actualizar `MatchStage` en `src/server/scoring/types.ts` con `"round-of-32"` antes de `"round-of-16"`.
- [ ] 3. Actualizar `BracketRound` en `src/server/matches/types.ts` y `BRACKET_ROUNDS` en `matches/queries.ts` (al principio del array).
- [ ] 4. Extender `parseStage` en `src/server/match-data/providers/api-football.parser.ts` para mapear `"round of 32"` / `"last 32"` / `"1/16"` a `"round-of-32"`. Orden importa: más específico antes que el patrón de round-of-16.
- [ ] 5. Tests del parser: 3 escenarios nuevos en `api-football.parser.test.ts` cubriendo los 3 strings.
- [ ] 6. Fixture nuevo en `src/server/scoring/edge-cases.fixtures.ts` con `stage: "round-of-32"` (prórroga + penaltis) y caso en `edge-cases.test.ts` validando que el engine aplica reglas de eliminatoria.
- [ ] 7. Test de render del bracket: `bracket-view.test.tsx` incluye ronda `round-of-32` con 16 partidos.
- [ ] 8. i18n: añadir clave `bracket.roundOf32` (o equivalente) en `messages/{es,en,fr,ar}.json` y referenciarla en el componente `BracketView`.
- [ ] 9. Docs: actualizar `docs/business-rules.md` (eliminatoria incluye round-of-32) y `docs/scoring.md` (tabla de stages).
- [ ] 10. Smoke build local: `npm run typecheck && npm test && npm run check`. Confirmar verde.
- [ ] 11. Promover `specs/match-data-providers/spec.md` a `openspec/specs/match-data-providers/spec.md` y archivar la propuesta en `archive/YYYY-MM-DD-add-round-of-32-stage/` tras el merge.
- [ ] (post-merge, ~28 jun 2026) Verificar `GET /fixtures/rounds?league=1&season=2026` cuando api-football publique los knockouts. Si el string no es ninguno de los 3 cubiertos, abrir hotfix con la variante real.
