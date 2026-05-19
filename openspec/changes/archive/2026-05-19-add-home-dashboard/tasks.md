# Tasks — add-home-dashboard

## Data layer

- [ ] 1. `src/server/dashboard/types.ts` con `DashboardData`, `UserStats`, `LiveMatchView`, `UpcomingMatch`, `Progress`, `MiniLeaderboardView`.
- [ ] 2. `src/server/dashboard/queries.ts` con las 6 queries individuales + `getDashboardData(userId)` que las paraleliza.
- [ ] 3. `src/server/dashboard/queries.test.ts` (db en memoria simulada) — ≥15 casos.

## Format helpers

- [ ] 4. `src/lib/format/date.ts` con `formatMatchDate(d, locale, today) → string` (devuelve "Hoy" / "Mañana" / fecha corta local).
- [ ] 5. `src/lib/format/date.test.ts` — ≥10 casos por locale.

## Components

- [ ] 6. `src/components/dashboard/hero.tsx` + test.
- [ ] 7. `src/components/dashboard/live-section.tsx` (decide live vs próximo) + test.
- [ ] 8. `src/components/dashboard/live-card.tsx` + test (incluye placeholder de puntos).
- [ ] 9. `src/components/dashboard/upcoming-hero-card.tsx` (fallback sin live) + test.
- [ ] 10. `src/components/dashboard/match-card.tsx` (3 variantes) + test.
- [ ] 11. `src/components/dashboard/progress-cards.tsx` + test (sparkline placeholder).
- [ ] 12. `src/components/dashboard/mini-leaderboard.tsx` + test.
- [ ] 13. `src/components/dashboard/floaters.tsx` (client, respeta reduced-motion) + test.

## i18n

- [ ] 14. Mensajes `dashboard.*` en es/en/fr/ar (saludos, secciones, placeholders).

## Route

- [ ] 15. `src/app/[locale]/(app)/inicio/page.tsx` con SSR de `getDashboardData(userId)` + ensamblado de bloques.
- [ ] 16. `src/app/[locale]/(app)/inicio/page.test.tsx` (snapshot ligero del DOM + render con/sin live).

## Cierre

- [ ] 17. Promover spec a `openspec/specs/home-dashboard/spec.md` y archivar.

## Deferred

- [ ] (deferred) `add-prediction-flow`: el CTA "Predecir" abre el flujo de submit/edit.
- [ ] (deferred) `add-ranking-history`: alimenta sparkline + delta semanal reales.
- [ ] (deferred) `add-live-scoring`: expone goles parciales del provider durante el live para activar puntos provisionales en tiempo real.
- [ ] (deferred) `add-leaderboard-sse`: refresca el panel en tiempo real.
