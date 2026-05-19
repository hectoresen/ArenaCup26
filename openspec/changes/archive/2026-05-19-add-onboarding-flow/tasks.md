# Tasks — add-onboarding-flow

## Schema

- [ ] 1. Migración drizzle: `users.onboarded_at timestamp nullable default null`.
- [ ] 2. Tipos de schema actualizados.

## Routing + guard

- [ ] 3. `src/app/[locale]/(app)/bienvenido/page.tsx` con steps 1/2/3.
- [ ] 4. Update del Auth.js callback `signIn` o middleware: tras OAuth, si `onboarded_at` null Y `country` null → redirect a `/bienvenido`.
- [ ] 5. Layout `(app)`: si user no `onboarded_at` y la ruta no es `/bienvenido`, redirect a `/bienvenido` (defensivo).

## Componentes

- [ ] 6. `Step1Identity` con `<NameInput>`, `<CountryCombobox>`, `<UsernameInput>` (reusa validation de signup).
- [ ] 7. `Step2HowItWorks` con 3 cards estáticas + ejemplo visual.
- [ ] 8. `Step3Ready` con CTA "Empezar" → server action que setea `onboarded_at`.

## Server actions

- [ ] 9. `completeOnboarding({ name, country, username })`:
  - Validación de username único.
  - UPDATE users SET name, country, username, onboarded_at = now().
  - Inserta entry en `username_history` si username cambió respecto al auto-gen.

## i18n

- [ ] 10. `messages/{es,en,fr,ar}.json` con namespace `onboarding`.

## Tests

- [ ] 11. Unit del server action `completeOnboarding` (errores de validación, conflictos de username, idempotencia).
- [ ] 12. Component test de cada step.
- [ ] 13. E2E flujo completo (lo cubre `add-e2e-tests`).

## Docs

- [ ] 14. `docs/decisions.md` §15 con la decisión de pedir país en onboarding vs autodetectar por IP.
