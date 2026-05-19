# Purpose

Habilitar tests de componentes React (Server-rendered y Client) en el proyecto, levantando React Testing Library + jsdom + un helper que envuelve los providers necesarios (i18n) para que los tests se centren en comportamiento.

# Requirements

## Requirement 1: Comando `npm test` ejecuta tests de componentes

`npm test` (alias de `vitest run`) descubre y ejecuta tanto tests de código puro como de componentes React.

### Scenario: Run de la suite

- **Given** un repo recién clonado con `npm install` ejecutado
- **When** se ejecuta `npm test`
- **Then** Vitest carga `vitest.setup.ts`, monta jsdom como entorno por defecto, y ejecuta todos los `*.test.ts(x)` bajo `src/`. Los tests de componentes que usan `<NextIntlClientProvider>` resuelven `useTranslations` correctamente.

## Requirement 2: Helper de providers reutilizable

Existe `src/test/render-with-providers.tsx` que envuelve cualquier elemento con los providers necesarios.

### Scenario: Render con i18n por defecto

- **Given** un componente que usa `useTranslations("leaderboard.row")`
- **When** se renderiza con `renderWithProviders(<Component />)`
- **Then** el componente accede a las traducciones en español (default) sin errores.

### Scenario: Render con otro locale

- **Given** el mismo componente
- **When** se renderiza con `renderWithProviders(<Component />, { locale: "en", messages: enMessages })`
- **Then** el componente accede a las traducciones en inglés.

## Requirement 3: Matchers de jest-dom disponibles

Los matchers `toBeInTheDocument`, `toHaveAttribute`, `toHaveTextContent`, etc., están disponibles en cualquier test sin import explícito.

### Scenario: Uso de `toBeInTheDocument`

- **Given** un test que renderiza un elemento y llama `expect(element).toBeInTheDocument()`
- **When** se ejecuta con `vitest run`
- **Then** el matcher resuelve gracias al setup `vitest.setup.ts` que carga `@testing-library/jest-dom/vitest`.

## Requirement 4: Tests de muestra pasan

Los tests añadidos en esta capability sirven como referencia y validan el setup.

### Scenario: `FaqItem` test

- **Given** el test de `FaqItem` ejecutado
- **When** Vitest lo corre
- **Then** los tres assertions pasan: render de pregunta y respuesta, estado inicial cerrado, toggle abre/cierra al click.

### Scenario: `RankRow` test

- **Given** el test de `RankRow` ejecutado
- **When** Vitest lo corre
- **Then** los cuatro assertions pasan: rank/name/puntos formateados, badge de racha visible con streak ≥ 3, "sin racha" con streak < 3, badge de aciertos visible.
