# Tasks — add-app-shell

- [ ] 1. Variables `--nav-h` y `--bn-h` en `src/app/globals.css` (theme block).
- [ ] 2. Mensajes `appShell.*` en `src/i18n/messages/{es,en,fr,ar}.json`.
- [ ] 3. `src/components/app-shell/icons.tsx` con los `<symbol>` reusables (trofeo, balón, medalla, bell, home, chevron). Inline-svg para evitar lib externa.
- [ ] 4. `src/components/app-shell/top-nav.tsx` (server) con logo + tabs + bell + avatar.
- [ ] 5. `src/components/app-shell/top-nav.test.tsx` (active tab por pathname, href correctos, sin sesión no renderiza, etc.).
- [ ] 6. `src/components/app-shell/bottom-nav.tsx` (server) idéntica al top-nav pero móvil.
- [ ] 7. `src/components/app-shell/bottom-nav.test.tsx`.
- [ ] 8. `src/components/app-shell/app-avatar.tsx` (server) con ring gradiente + iniciales o `<img>`.
- [ ] 9. `src/components/app-shell/app-avatar.test.tsx` (iniciales, fallback, ring class).
- [ ] 10. `src/components/app-shell/notification-bell.tsx` (client) — solo el botón + badge; el dropdown queda para `add-notifications`.
- [ ] 11. `src/components/app-shell/notification-bell.test.tsx` (badge visible/oculto, aria con conteo).
- [ ] 12. `src/components/app-shell/app-shell.tsx` (server) ensambla todo y aplica el `<main>` con max-width 720 + paddings.
- [ ] 13. `src/app/[locale]/(app)/layout.tsx` con `auth()` + redirect + `<AppShell>`.
- [ ] 14. `(app)/layout.test.ts` (redirect cuando no hay sesión, render del shell cuando sí).
- [ ] 15. Promover spec a `openspec/specs/app-shell/spec.md` y archivar.
- [ ] (deferred) `add-notifications`: dropdown del bell con eventos reales (logros, predicciones bloqueadas, etc.).
- [ ] (deferred) `add-account-menu`: ya existe parcialmente; consolidar con el avatar del shell.
