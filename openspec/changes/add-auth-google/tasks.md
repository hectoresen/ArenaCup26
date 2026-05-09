# Tasks — add-auth-google

- [x] 1. Renombrar env vars a `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` en `src/lib/env.ts` y validar con Zod.
- [x] 2. Actualizar `src/lib/auth.ts` para consumir las nuevas vars y pasarlas explícitamente al provider `Google({ clientId, clientSecret })`.
- [x] 3. Crear `src/app/api/auth/[...nextauth]/route.ts` que re-exporta `handlers.GET` y `handlers.POST` de `src/lib/auth.ts`.
- [x] 4. Actualizar `JoinCta` para llamar `signIn("google", { callbackUrl: "/" })` desde `next-auth/react`. Añadir estado `pending` y label "Redirigiendo…" mientras se procesa.
- [x] 5. Crear `.env` local con credenciales reales + `AUTH_SECRET` generado. NO commiteado.
- [x] 6. Actualizar `.env.example` con la nueva nomenclatura.
- [ ] 7. Configurar la URL de callback en la consola de Google: añadir `http://localhost:3000/api/auth/callback/google` (dev) y la de producción cuando se sepa.
- [ ] 8. Levantar Postgres local y ejecutar `pnpm db:generate && pnpm db:migrate` para que el adapter pueda escribir.
- [ ] 9. Smoke test manual: click en "Continuar con Google" → consentimiento Google → callback → fila creada en `users` y `accounts` → redirect a `/`.
- [ ] 10. Promover `specs/auth/spec.md` a `openspec/specs/auth/spec.md`.
- [ ] 11. Mover propuesta a `openspec/changes/archive/YYYY-MM-DD-add-auth-google/`.
- [ ] (deferred) `add-auth-onboarding`: mockup + propuesta para que el primer login pida username y país.
- [ ] (deferred) `add-account-menu`: ocupa el slot top-right cuando hay sesión, sustituyendo el `JoinCta`.
