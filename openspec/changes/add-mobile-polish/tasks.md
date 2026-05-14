# Tasks — add-mobile-polish

## Safe area

- [ ] 1. `viewport-fit=cover` en metadata.
- [ ] 2. Tailwind `safe-*` utilities o env() inline.
- [ ] 3. Bottom nav + top nav respetan safe-area.

## Sticky hover

- [ ] 4. Audit de clases `hover:*` → wrap con `@media (hover:hover)` cuando aplique.

## Tap targets

- [ ] 5. Audit Lighthouse mobile.
- [ ] 6. Ajustar tamaños mínimos en podium, bell, switches.

## Pull-to-refresh

- [ ] 7. Hook `usePullToRefresh()` con touchstart/touchmove.
- [ ] 8. Aplicar en /inicio y /ranking.
- [ ] 9. Indicador visual minimal.

## Haptic

- [ ] 10. Helper `vibrate(pattern)` en `src/lib/haptic.ts`.
- [ ] 11. Wirear en submit prediction + unlock achievement.

## PWA

- [ ] 12. `public/manifest.json` con icons 192/512, display standalone, theme_color.
- [ ] 13. `<link rel="manifest">` en metadata.
- [ ] 14. SW mínimo (reusar el de web-push).
- [ ] 15. Banner "Añadir a pantalla principal" si `beforeinstallprompt`.

## A11y audit

- [ ] 16. Lighthouse a11y score ≥ 95 en /inicio.
- [ ] 17. Lighthouse a11y score ≥ 95 en /ranking.
- [ ] 18. Lighthouse a11y score ≥ 95 en /partidos.
- [ ] 19. Lighthouse a11y score ≥ 95 en /u/<username>.
- [ ] 20. Lighthouse a11y score ≥ 95 en /logros.

## Tests

- [ ] 21. Test manual en iPhone real + Android real (anotar issues).
- [ ] 22. E2E webkit project ya en `add-e2e-tests`.

## Docs

- [ ] 23. `docs/mobile-checklist.md` para futuros componentes.
