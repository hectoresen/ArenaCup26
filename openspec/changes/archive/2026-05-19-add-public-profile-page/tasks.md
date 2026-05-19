# Tasks — add-public-profile-page

## Username (puente hacia `add-onboarding`)

- [x] 1. `src/server/users/username.ts` con `slugifyName` + `resolveAvailableUsername`.
- [x] 2. `src/server/users/username.test.ts` (21 casos).
- [x] 3. Auth.js `events.createUser` + `callbacks.session` en `src/lib/auth.ts`.
- [x] 4. `src/types/next-auth.d.ts` extendiendo `Session.user` con `id` + `username`.

## Data layer

- [ ] 5. `src/server/public-profile/types.ts`.
- [ ] 6. `src/server/public-profile/transforms.ts` con agrupación por tier + helpers puros.
- [ ] 7. `src/server/public-profile/transforms.test.ts`.
- [ ] 8. `src/server/public-profile/queries.ts` con `getPublicProfile(db, username)`.

## Componentes

- [ ] 9. `src/components/public-profile/profile-hero.tsx` + test.
- [ ] 10. `src/components/public-profile/copy-link-button.tsx` (client) + test.
- [ ] 11. `src/components/public-profile/stats-row.tsx` + test.
- [ ] 12. `src/components/public-profile/achievement-card.tsx` + test (locked/unlocked).
- [ ] 13. `src/components/public-profile/tier-section.tsx` + test.
- [ ] 14. `src/components/public-profile/achievements-accordion.tsx` + test.

## Ruta + i18n + menu

- [ ] 15. `src/app/[locale]/u/[username]/page.tsx` con SSR + notFound.
- [ ] 16. Mensajes `publicProfile.*` en es/en/fr/ar.
- [ ] 17. `accountMenu.profile` + link "Mi perfil" en `AccountMenu`.

## Cierre

- [ ] 18. Tests + typecheck + biome + `next build`.
- [ ] 19. Promover spec a `openspec/specs/public-profile-page/spec.md` y archivar.

## Deferred

- [ ] (deferred) `add-onboarding`: pantalla post-login para confirmar/editar username y país.
- [ ] (deferred) `add-username-edit`: edición posterior con blacklist de rutas reservadas.
- [ ] (deferred) `add-public-profile-og`: imagen OG dinámica + meta tags completos para social cards.
- [ ] (deferred) Indicador "Activo hoy" (requiere `users.last_active_at`).
