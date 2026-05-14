# Tasks — add-e2e-tests

## Setup

- [ ] 1. `npm install -D @playwright/test`.
- [ ] 2. `npx playwright install --with-deps chromium webkit`.
- [ ] 3. `playwright.config.ts` con `webServer: { command: "npm run dev", port: 3000, reuseExistingServer: true }`.
- [ ] 4. `e2e/fixtures/db.ts` con `truncate()` + seed helpers.
- [ ] 5. `e2e/fixtures/auth.ts` para crear cookie de sesión Auth.js bypassando Google.

## Golden paths

- [ ] 6. `e2e/landing.spec.ts` — anon visita /, ve leaderboard + CTA.
- [ ] 7. `e2e/login.spec.ts` — flujo OAuth mockeado redirige a /inicio.
- [ ] 8. `e2e/dashboard.spec.ts` — bloques visibles, mini-leaderboard real.
- [ ] 9. `e2e/predict.spec.ts` — submit simple → bell counter incrementa.
- [ ] 10. `e2e/scoring.spec.ts` — forzar finished + reload → puntos suben.
- [ ] 11. `e2e/ranking.spec.ts` — user aparece tras puntuar.
- [ ] 12. `e2e/logros.spec.ts` — first-hit desbloqueado tras acierto.
- [ ] 13. `e2e/public-profile.spec.ts` — /u/<username> sin login.
- [ ] 14. `e2e/locale-rtl.spec.ts` — switch a ar, document.dir === "rtl".
- [ ] 15. `e2e/empty-states.spec.ts` — BD vacía → friendly state.

## CI

- [ ] 16. `.github/workflows/e2e.yml`: job en PRs con postgres service, ejecuta `npm run e2e --reporter=github`.
- [ ] 17. Artifact upload de traces en fallo.
- [ ] 18. Badge de status en README.

## Docs

- [ ] 19. `docs/testing.md` con: cómo correr E2E localmente, cómo añadir un test nuevo, cómo debuggear con trace viewer.
