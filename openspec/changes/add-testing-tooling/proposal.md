# add-testing-tooling

## Why

Vitest está scaffoldado desde el primer commit, pero solo testea código puro (`mock.test.ts`). Cualquier propuesta de UI cierra con la nota "deferred — tests con React Testing Library cuando se añada al stack". Es momento de añadirlo: tres propuestas (`add-join-cta`, `add-account-menu`, `add-i18n`, `add-error-pages`, `add-faq`) ya lo tienen anotado.

Sin tests de componentes, cualquier refactor (típicamente RTL para árabe, refactor de slots, cambio de copy) se valida solo a ojo. A medida que el producto crezca, la regresión silenciosa pasará a ser cuestión de tiempo.

## What changes

Capability nueva: **`testing-tooling`**.

- Dependencias devDependencies:
  - `@testing-library/react@^16.1.0` (compatible con React 19).
  - `@testing-library/jest-dom@^6.6.3` (matchers `toBeInTheDocument`, etc.).
  - `@testing-library/user-event@^14.5.2` (interacciones realistas).
  - `jsdom@^26.0.0` (entorno DOM).
  - `@vitejs/plugin-react@^4.3.4` (transform de JSX/TSX para Vitest).
- `vitest.config.ts`: añadir plugin React, environment `jsdom`, `setupFiles`.
- `vitest.setup.ts`: cargar `@testing-library/jest-dom/vitest` para los matchers.
- `src/test/render-with-providers.tsx`: helper que envuelve con `<NextIntlClientProvider>` (mensajes en español por defecto). Re-exporta los helpers de `@testing-library/react` y `userEvent` para que los tests importen de un único sitio.
- Tests de muestra:
  - `src/components/faq/faq-item.test.tsx` (toggle open/close de `<details>` nativo).
  - `src/components/leaderboard/rank-row.test.tsx` (rank, nombre, puntos formateados, badge de racha, "sin racha").

**No incluye**:

- Tests E2E (Playwright). Ya está configurado y se usará en otra propuesta cuando haya flujos críticos (login real, predicción real, etc.).
- Snapshots (`toMatchSnapshot`). Genera ruido en CI con cambios visuales legítimos. Preferencia: tests basados en comportamiento.
- Cobertura mínima como gate. Por ahora se mide manual; cuando establezcamos un threshold, se añade en otra propuesta.

## Impact

- **Bloquea**: nada.
- **Desbloquea**: las tareas "deferred — RTL" de las propuestas anteriores. Cualquier nuevo componente puede añadir tests sin más fricción.
- **Riesgos**:
  - `@testing-library/react@16` requiere React 19. Si Next bumpa a React 20, hay que actualizar.
  - `next-intl` Server Components no se testean igual que Client. El helper actual solo cubre Client Components y los Server Components que usan `useTranslations` (que internamente lee del provider). Si en el futuro queremos testear Server Components puros (con `getTranslations`), habrá que añadir un setup distinto. Anotado para cuando aparezca.

## Decisiones tomadas

- **Helper único `renderWithProviders`** en lugar de un wrapper auto-aplicado por Vitest. Beneficio: el test es explícito sobre qué providers usa; útil cuando se quiera variar locale o mocks.
- **Re-export de `screen`, `userEvent` y otros desde el helper**: los tests importan todo de `@/test/render-with-providers`, sin depender de los paths exactos de RTL. Si cambia la versión de RTL, se actualiza en un solo sitio.
- **Sin snapshot tests** por defecto. Las animaciones, fuentes web y emojis bandera generan diffs constantes en snapshots; los tests basados en aria-labels y texto son más robustos.
- **Setup global** vs. per-test: setup global con `jest-dom` es lo estándar y reduce boilerplate.
