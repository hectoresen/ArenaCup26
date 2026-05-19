# Tasks — add-achievements-seed

- [x] 1. `src/server/achievements/catalog.ts` con tipos `AchievementTier`, `AchievementDefinition` y la constante `ACHIEVEMENT_CATALOG` (24 entradas en español).
- [x] 2. `src/server/achievements/seed.ts` con `seedAchievements(db)` idempotente vía `ON CONFLICT DO UPDATE`.
- [x] 3. `scripts/seed-achievements.ts` entrypoint CLI.
- [x] 4. `package.json`: script `seed:achievements` y devDep `tsx`.
- [x] 5. `src/server/achievements/catalog.test.ts` con 9 tests cubriendo total, distribución por tier, unicidad de IDs, sortOrder, isShareable, no-empty fields, kebab-case, GOAT singleton, IDs anchor referenciados.
- [ ] 6. Ejecutar `npm install` para descargar `tsx`.
- [ ] 7. Smoke check: `npm run seed:achievements` con Postgres corriendo → log "Upserted 24 achievements."
- [ ] 8. Smoke check: `npm test` corre los 9 tests del catálogo.
- [ ] 9. Promover `specs/achievements-seed/spec.md` a `openspec/specs/achievements-seed/spec.md` y archivar.
- [ ] (deferred) Localización de `title`/`description` en `messages/{locale}.json` cuando aterrice `add-achievements` (UI).
- [ ] (deferred) Motor de unlocks que evalúa qué logros desbloquea el usuario tras el cierre de un partido.
