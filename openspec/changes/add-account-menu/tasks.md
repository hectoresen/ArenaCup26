# Tasks — add-account-menu

- [x] 1. Componente `AccountMenu` en `src/components/auth/account-menu.tsx`: trigger pill con avatar + hamburguesa, dropdown con cabecera (nombre + email) y opción "Cerrar sesión". Click fuera y Escape cierran. Foco vuelve al trigger al cerrar con teclado.
- [x] 2. `signOut({ callbackUrl: "/" })` desde `next-auth/react` al pulsar "Cerrar sesión", con estado `signingOut` que deshabilita el botón y muestra "Cerrando sesión…".
- [x] 3. `src/app/page.tsx` resuelve `auth()` server-side y pasa `session?.user ?? null` a `<LeaderboardView />`.
- [x] 4. `<LeaderboardView />` acepta `user: SessionUser | null` y renderiza condicionalmente `<AccountMenu user={user} />` o `<JoinCta />` en el slot `fixed top-right`.
- [ ] 5. Smoke check manual: login → ves AccountMenu en lugar de "Predecir ahora"; click → dropdown abre; "Cerrar sesión" → vuelves a `/` como anónimo y ves "Predecir ahora" otra vez.
- [ ] 6. Promover `specs/account-menu/spec.md` a `openspec/specs/account-menu/spec.md`.
- [ ] 7. Mover propuesta a `archive/`.
- [ ] (deferred) Items adicionales del menú según vayan aterrizando capabilities privadas (Mi perfil, Mis predicciones, Configuración…).
- [ ] (deferred) `useSession()` + `<SessionProvider>` cuando la navegación SPA exija reactividad ante cambios de sesión sin recargar.
