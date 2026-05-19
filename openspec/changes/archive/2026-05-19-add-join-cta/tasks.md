# Tasks — add-join-cta

- [x] 1. Componente `JoinCta` en `src/components/leaderboard/join-cta.tsx` con el botón gold "Predecir ahora" y `<dialog>` nativo embebido (logo G de Google con SVG inline 4 colores oficiales, stub `onClick`).
- [x] 2. Posicionar el CTA en `fixed top-right` (`top-3 right-3` mobile, `top-5 right-5` desktop, `z-30`) en `LeaderboardView` para que no compita con el ranking.
- [x] 3. Padding y tipografía responsive en el botón (`px-3 py-2 text-[11px]` en mobile, `px-5 py-2.5 text-[13px]` en desktop) para encajar en pantallas estrechas.
- [ ] 4. Smoke check manual: foco vuelve al botón al cerrar, Escape cierra, click backdrop cierra.
- [ ] 5. Promover `specs/auth-entry/spec.md` a `openspec/specs/auth-entry/spec.md`.
- [ ] 6. Mover propuesta a `archive/`.
- [ ] (deferred) Tests con React Testing Library cuando se añada al stack en una propuesta de tooling.
- [ ] (deferred) Propuesta separada `add-account-menu`: ocupa el mismo slot top-right cuando el usuario está autenticado, con avatar y menú hamburguesa.
