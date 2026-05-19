# Tasks — add-product-analytics

## Setup

- [ ] 1. Crear cuenta Plausible + propiedad wmundial.app.
- [ ] 2. Añadir script en `<head>` vía Next layout (raíz).
- [ ] 3. CSP: añadir `plausible.io` a `script-src` y `connect-src`.

## Helper

- [ ] 4. `src/lib/analytics.ts` con `track(event, props)` typed.
- [ ] 5. Noop si script no cargado (offline / adblocker).

## Eventos

- [ ] 6. Signup → callback Auth.js.
- [ ] 7. Onboarding (3 eventos).
- [ ] 8. PredictionSubmitted en submit handler.
- [ ] 9. MatchOpened en page de detalle.
- [ ] 10. AchievementUnlocked cuando aterrice unlock pipeline.
- [ ] 11. Hooks futuros: FriendRequest*, Push*, RankingViewed.

## Dashboards

- [ ] 12. Configurar funnel en Plausible.
- [ ] 13. Configurar goals (Signup, FirstPrediction).
- [ ] 14. Screenshot del dashboard inicial en `docs/operations.md`.

## Privacy

- [ ] 15. Docs/privacy.md con explicación: usamos analítica sin cookies; no se almacena IP.
- [ ] 16. Opt-out toggle en `/ajustes/privacidad` (cuando aterrice).

## Tests

- [ ] 17. Mock window.plausible en tests para verificar llamadas.

## Docs

- [ ] 18. `docs/decisions.md` §22 con Plausible vs PostHog (decisión: Plausible).
