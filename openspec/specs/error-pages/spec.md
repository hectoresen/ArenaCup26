# Purpose

Servir páginas de error (404 y runtime) que sigan el lenguaje visual de ArenaCup26 y respeten el locale del usuario, en vez de caer al fallback genérico de Next.js. Garantiza un suelo de calidad bajo cualquier propuesta futura: si una página falla o no existe, el usuario sigue dentro del producto.

# Requirements

## Requirement 1: 404 localizada con brand

Una request a una ruta inexistente dentro de `[locale]` devuelve la página `not-found.tsx` con el brand y el idioma resuelto.

### Scenario: Ruta inexistente en español

- **Given** un visitante navega a `/algo-que-no-existe`
- **When** Next resuelve la ruta
- **Then** se renderiza `[locale]/not-found.tsx` con el código "404" en gold, título "Página no encontrada", descripción y un botón "Volver al inicio" enlazando a `/`. El switcher de idioma sigue visible en top-start.

### Scenario: Ruta inexistente en árabe

- **Given** un visitante navega a `/ar/foo`
- **When** Next resuelve la ruta
- **Then** se renderiza la 404 con `<html lang="ar" dir="rtl">`, título "الصفحة غير موجودة" y el switcher reflejando árabe.

## Requirement 2: Página de error runtime con retry

Cuando un Server o Client Component dentro de `[locale]` lanza una excepción no capturada, se renderiza `error.tsx` con dos acciones: reintentar y volver al inicio.

### Scenario: Click en "Intentar de nuevo"

- **Given** un usuario en una página que ha caído en `error.tsx`
- **When** hace click en el botón gold "Intentar de nuevo"
- **Then** se invoca el `reset()` que Next pasa como prop, el segmento se vuelve a renderizar, y si el problema era transitorio, la UI se recupera.

### Scenario: Click en "Volver al inicio"

- **Given** la misma página de error
- **When** hace click en el botón secundario "Volver al inicio"
- **Then** se navega a `/{locale}` (Link de `@/i18n/navigation` respeta el locale actual).

### Scenario: Logging mínimo del error

- **Given** la página de error montada
- **When** el `useEffect` se ejecuta tras el primer render
- **Then** el error se loguea a `console.error` con prefijo `[wmundial] runtime error`. (Logging a servicios externos queda diferido.)

## Requirement 3: Fallback global catastrófico

Cuando un error rompe POR ENCIMA del segmento `[locale]` (root layout, provider de i18n, etc.), se renderiza `global-error.tsx`.

### Scenario: Error en el provider de i18n

- **Given** el provider de mensajes falla al cargar
- **When** Next intenta renderizar la app
- **Then** `global-error.tsx` se renderiza con su propio `<html lang="en"><body>`, mensaje en inglés "Something went wrong" y un botón "Reload" que invoca `reset()`. Sin fuentes externas ni i18n, solo inline styles.

## Requirement 4: Brand consistente

Las páginas de error mantienen los tokens visuales del producto.

### Scenario: Paleta y fuentes

- **Given** la 404 o la error.tsx renderizadas
- **When** se inspeccionan
- **Then** usan `--color-gold` para el código, Fredoka para títulos, Nunito para descripción, y los `<FloatingBalls />` de fondo. Los botones gold copian el estilo del CTA "Predecir ahora" del leaderboard.

### Scenario: Switcher de idioma siempre presente

- **Given** la 404 o la error.tsx
- **When** el visitante observa la página
- **Then** ve el `<LanguageSwitcher />` en la esquina top-start (mismo slot que en la home).

## Requirement 5: Accesibilidad mínima

Las páginas de error son navegables con teclado y respetan `prefers-reduced-motion`.

### Scenario: Tab navega a los botones

- **Given** la 404
- **When** el usuario pulsa Tab
- **Then** el foco viaja al switcher de idioma → al botón "Volver al inicio". Cada elemento tiene un foco visible.

### Scenario: Reduced motion respetado

- **Given** un usuario con `prefers-reduced-motion: reduce`
- **When** carga la 404
- **Then** las animaciones `popIn` y `fadeUp` tienen duración cero (regla global ya definida en `globals.css`).
