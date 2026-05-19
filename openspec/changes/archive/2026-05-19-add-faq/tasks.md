# Tasks — add-faq

- [x] 1. `<TopChrome />` reusable en `src/components/layout/top-chrome.tsx`.
- [x] 2. Refactor `<LeaderboardView />` para consumir `<TopChrome />` y eliminar el markup duplicado.
- [x] 3. `<ScoringTable />` en `src/components/faq/scoring-table.tsx` con 10 filas (simple, exacto, doble, falla, combo base, combo modificado, encuesta participar, encuesta acertar, referido, login diario) y tones según tipo.
- [x] 4. `<FaqItem />` en `src/components/faq/faq-item.tsx` con `<details>` nativo y chevron rotatorio.
- [x] 5. Página `src/app/[locale]/faq/page.tsx` con `setRequestLocale`, header, ScoringTable, 9 ítems Q&A y botón "Volver al ranking".
- [x] 6. Link "Preguntas frecuentes" en `<AccountMenu />` (entre user info y "Cerrar sesión", cierra el dropdown al click).
- [x] 7. Link "¿Cómo funciona? Lee las preguntas frecuentes →" en el footer del modal de `<JoinCta />` (cierra el dialog al click).
- [x] 8. Namespace `faq` en `messages/{es,en,fr,ar}.json` con `scoring.rows.*` y `questions.items.*`.
- [x] 9. Claves añadidas en `accountMenu.faq` y `joinCta.modal.faqLink` en los 4 idiomas.
- [ ] 10. Smoke check manual: navegar a `/faq`, `/en/faq`, `/fr/faq`, `/ar/faq`. Comprobar que los `<details>` abren al click y que el árabe rinde RTL correctamente.
- [ ] 11. Promover `specs/faq/spec.md` a `openspec/specs/faq/spec.md` y archivar.
- [ ] (deferred) Anchors `#id` por pregunta para deep-linking.
- [ ] (deferred) Búsqueda interna en el FAQ.
- [ ] (deferred) Revisión nativa de las traducciones del árabe.
