# Tasks — add-matches-filters

## Backend

- [ ] 1. Extender `getMatchesList` con filtros opcionales `{when, leagueIds, onlyMine}`.
- [ ] 2. Index defensivo `matches_kickoff_idx` (verificar que existe).
- [ ] 3. Query helper `getAvailableLeagues()` para popular el dropdown.

## URL state

- [ ] 4. `/partidos/page.tsx` parsea `searchParams` y los pasa a la query.
- [ ] 5. Componente `<FilterBar>` client-side que actualiza URL con `useRouter().replace()`.

## UI

- [ ] 6. Pills con animación de selección.
- [ ] 7. Dropdown ligas con `<Combobox>` (Radix UI o custom).
- [ ] 8. Switch "Solo con mi predicción".
- [ ] 9. EmptyState variante "filtros sin resultados".

## Favoritos (fase 2)

- [ ] 10. `user_preferences.favorite_leagues int[]` o JSONB en users.
- [ ] 11. Default filters del user al cargar.

## i18n

- [ ] 12. Namespace `matches.filters.*` para todas las cadenas.

## Tests

- [ ] 13. Unit de la query con cada combo de filtros.
- [ ] 14. E2E: seleccionar pill "Hoy" → lista solo hoy; deseleccionar → vuelve.
