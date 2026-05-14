# add-e2e-tests

## Why

464 tests verde nos da seguridad de unidades aisladas (engine, queries, components), pero no garantiza que el **flujo end-to-end** funciona desde el navegador hasta la BD:

- `Login Google → /inicio → seleccionar partido → predecir simple → ver notificación` — no testeado E2E.
- `Cron sync trae fixtures → user predice → partido finished → scoring corre → user ve puntos en /ranking` — verificación manual.
- `/u/<username>` accesible sin sesión, `/inicio` redirige sin sesión — sin testear.
- Locale switch ar (RTL) — sin pruebas visuales.

Cada regresión cuesta tiempo de debugging que un E2E habría detectado.

## What changes

Capability nueva: **`e2e-tests`**.

### Stack

- **Playwright** con `@playwright/test`. Razones: rápido, paralelizable, screenshots automáticos en fallo, soporte multi-browser, mejor que Cypress para Next 15.
- Trace viewer integrado para post-mortem.

### Setup

- `playwright.config.ts` con dos projects: chromium y webkit (mobile safari simulado).
- `e2e/fixtures/db.ts`: helper que limpia BD antes de cada test y siembra fixtures mínimos.
- `e2e/fixtures/auth.ts`: helper para mockear sesión Auth.js (cookie firmada con AUTH_SECRET de test).
- `npm run e2e` + `npm run e2e:ui`.

### Golden paths cubiertos

1. **Anon → landing → CTA Predecir → modal Google** (mock).
2. **Login → /inicio → ver hero + próximo partido + mini-leaderboard**.
3. **Predicción**: `/partidos/<id>` → seleccionar simple → submit → notificación aparece en bell.
4. **Scoring**: forzar transición de un match a `finished` vía helper → call a `processFinishedMatch` directo → recargar `/inicio` → ver puntos.
5. **Ranking**: /ranking muestra al user logado en su posición real.
6. **Logros**: tras un acierto, `/logros` muestra `first-hit` desbloqueado.
7. **Perfil público**: `/u/<username>` accesible sin login.
8. **Locale switch**: cambiar a `ar`, layout en RTL.
9. **Empty states**: si BD vacía, `/partidos` muestra el componente friendly.

### CI

- GitHub Actions: job nuevo que arranca Postgres en service container + Next build + Playwright.
- Solo en PRs (no en cada push a main por coste).

## Impact

- **Coste**: ~5min más en CI por PR. Aceptable.
- **Riesgo**: tests flaky por timing. Mitigación: waitFor con timeouts generosos, no sleeps; Playwright auto-retry.
- **Bloquea**: nada, pero acelera cualquier propuesta futura porque la regresión se detecta antes.
