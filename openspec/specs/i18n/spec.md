# Purpose

Servir la aplicación en cuatro idiomas (español, inglés, francés y árabe) con detección automática del locale en la primera visita, cambio explícito persistente vía cookie, y soporte completo de **RTL** para árabe. Sienta la base para que toda capability de UI futura sea i18n-aware desde el primer commit.

# Requirements

## Requirement 1: Soporte multi-locale en la home

La página `/` se sirve en el idioma adecuado según el locale resuelto por el middleware.

### Scenario: Visitante con cookie `NEXT_LOCALE=fr`

- **Given** un visitante con cookie `NEXT_LOCALE=fr`
- **When** navega a la raíz `/`
- **Then** el middleware redirige a `/fr/` y la página se renderiza con todos los strings en francés.

### Scenario: Visitante anónimo con `Accept-Language: ar-SA`

- **Given** un visitante sin cookie y con `Accept-Language: ar-SA,ar;q=0.9`
- **When** carga `/`
- **Then** el middleware detecta `ar` como mejor coincidencia y redirige a `/ar/`. La página se sirve con `<html lang="ar" dir="rtl">`.

### Scenario: Visitante anónimo sin Accept-Language coincidente

- **Given** un visitante sin cookie y con `Accept-Language: ja-JP`
- **When** carga `/`
- **Then** se sirve `/` (default `es`) sin redirección.

## Requirement 2: Cambio de locale siempre visible y persistente

El `<LanguageSwitcher />` está siempre visible en la esquina superior **start** del viewport (top-left en LTR, top-right en RTL), sin necesidad de abrir ningún modal o menú. Cambiar el idioma persiste vía cookie `NEXT_LOCALE` con TTL de 1 año.

### Scenario: Switcher visible al cargar la página

- **Given** un visitante (anónimo o autenticado) en `/`
- **When** se renderiza la página
- **Then** ve el switcher fijo en la esquina superior start con el idioma actual (código `ES`/`EN`/`FR`/`AR` en mobile, nombre nativo en desktop).

### Scenario: Cambio de idioma desde el switcher

- **Given** el switcher visible en español con dropdown cerrado
- **When** el usuario lo abre y elige "English"
- **Then** la cookie `NEXT_LOCALE=en` se establece con TTL 1 año, el navegador navega a `/en/` y la página se vuelve a renderizar con strings en inglés. La sesión, si la había, se mantiene.

### Scenario: Layout simétrico con el slot top-end

- **Given** la página renderizada
- **When** un visitante observa la cabecera
- **Then** el switcher ocupa la esquina top-start y el `JoinCta`/`AccountMenu` ocupa la esquina top-end. En RTL ambos se mirror automáticamente.

## Requirement 3: RTL para árabe

El layout cambia de dirección cuando `locale === "ar"`.

### Scenario: Atributos del html

- **Given** una request con locale resuelto a `ar`
- **When** el layout raíz se renderiza
- **Then** el `<html>` tiene `lang="ar"` y `dir="rtl"`.

### Scenario: Slot top-right en RTL

- **Given** la página en `ar`
- **When** se renderiza el slot del `JoinCta` o `AccountMenu`
- **Then** aparece visualmente en el **top-LEFT** del viewport (porque `top-end` se invierte en RTL), no en el top-right.

### Scenario: Footer alineado al final de lectura

- **Given** la página en `ar`
- **When** se renderiza el footer del leaderboard
- **Then** el slogan "WE ARE 26" queda alineado al borde **izquierdo** (end en RTL).

## Requirement 4: API routes ignoradas por el middleware

El middleware no toca las rutas de API.

### Scenario: Callback de Auth.js no es prefixed

- **Given** Google completa el OAuth y redirige a `/api/auth/callback/google?code=...`
- **When** el middleware procesa la request
- **Then** la deja pasar sin modificación; Auth.js procesa el callback con normalidad y la sesión se crea correctamente.

## Requirement 5: Strings de marca preservados

Los elementos identitarios del brand no se traducen.

### Scenario: Logo "We Are 26" en cualquier locale

- **Given** la página en `ar`, `fr` o `en`
- **When** se renderiza el header del leaderboard
- **Then** el bloque del logo muestra "We Are" + "26" idéntico en los 4 locales.

### Scenario: "FIFA World Cup" en árabe

- **Given** la página en `ar`
- **When** se renderiza el tagline
- **Then** "FIFA World Cup" aparece tal cual (Latin script). Solo los nombres de los países anfitriones (Canadá, México, USA) se traducen.

## Requirement 6: Validación de locale desconocido

Una request a un locale no soportado devuelve 404.

### Scenario: URL con locale inválido

- **Given** una URL `/de/algo`
- **When** el visitante navega
- **Then** el layout invoca `notFound()` y se sirve la página de no-encontrado (cuando aterrice `add-error-pages`).

## Requirement 7: Catálogo de mensajes versionado

Los mensajes viven en archivos JSON por locale, versionados en git.

### Scenario: Añadir una nueva clave

- **Given** un developer añade una nueva clave en `messages/es.json`
- **When** la usa en un componente con `useTranslations()`
- **Then** debe añadirla también en `en.json`, `fr.json` y `ar.json` antes de hacer merge. Si una clave falta en algún idioma, `next-intl` lanza un error de runtime visible en los logs y la UI muestra el código de la clave en lugar del texto.
