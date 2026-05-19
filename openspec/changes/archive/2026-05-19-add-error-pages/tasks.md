# Tasks — add-error-pages

- [x] 1. Componente `<ErrorScreen />` en `src/components/error/error-screen.tsx` (Server-ready, sin `"use client"`).
- [x] 2. `src/app/[locale]/not-found.tsx` con `<ErrorScreen />` + `<LanguageSwitcher />` en top-start + `<FloatingBalls />` de fondo + Link "Volver al inicio".
- [x] 3. `src/app/[locale]/error.tsx` (Client) con `<ErrorScreen />` + retry button (`onClick={reset}`) + Link de respaldo a `/`. Loguea el error a `console.error`.
- [x] 4. `src/app/global-error.tsx` minimal con inline styles, English-only.
- [x] 5. Namespace `errors` en `messages/{es,en,fr,ar}.json` con `notFound` y `runtime`.
- [ ] 6. Smoke check manual: navegar a `/algo-que-no-existe`, `/en/algo-que-no-existe`, `/ar/algo-que-no-existe` → ver 404 traducido.
- [ ] 7. Smoke check manual: forzar un throw en cualquier page → ver `error.tsx` y que `Intentar de nuevo` rerenderiza.
- [ ] 8. Promover `specs/error-pages/spec.md` a `openspec/specs/error-pages/spec.md` y archivar.
- [ ] (deferred) Logging del error a un servicio (Sentry, Logtail) cuando se decida proveedor.
- [ ] (deferred) Página específica para errores de Auth.js (`/api/auth/error`).
