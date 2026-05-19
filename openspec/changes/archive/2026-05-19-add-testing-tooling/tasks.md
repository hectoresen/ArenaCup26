# Tasks — add-testing-tooling

- [x] 1. Añadir devDependencies a `package.json`: `@testing-library/react`, `jest-dom`, `user-event`, `jsdom`, `@vitejs/plugin-react`.
- [x] 2. `vitest.config.ts`: plugin react, environment `jsdom`, `setupFiles`.
- [x] 3. `vitest.setup.ts` con `import "@testing-library/jest-dom/vitest"`.
- [x] 4. Helper `src/test/render-with-providers.tsx` con `<NextIntlClientProvider>` y re-exports.
- [x] 5. Sample test: `src/components/faq/faq-item.test.tsx` (toggle de `<details>`).
- [x] 6. Sample test: `src/components/leaderboard/rank-row.test.tsx` (rank + name + points + streak).
- [ ] 7. Verificar que `npm test` pasa los 3 tests (mock.test.ts existente + los 2 nuevos).
- [ ] 8. Promover `specs/testing-tooling/spec.md` a `openspec/specs/testing-tooling/spec.md` y archivar.
- [ ] (deferred) Tests para `<JoinCta />`, `<AccountMenu />`, `<LanguageSwitcher />`, `<ErrorScreen />`, `<ScoringTable />` cuando aporten cobertura.
- [ ] (deferred) Threshold de cobertura mínima en CI.
- [ ] (deferred) Setup específico para Server Components puros (con `getTranslations`).
