# Purpose

Página pública `/u/<username>` con identidad, stats y catálogo de logros del usuario. Auto-gen del username al primer login Google con sufijo numérico si colisiona.

# Requirements

## Requirement 1: Username auto-gen al primer login

El callback `events.createUser` rellena `users.username` con un slug del nombre del provider.

### Scenario: nombre normal

- **Given** Auth.js dispara `createUser` con `user.name = "Carlos Mendoza"` y `username` está vacío
- **When** `slugifyName(name)` se ejecuta
- **Then** devuelve `"carlos-mendoza"`. El callback escribe esto en `users.username`.

### Scenario: nombre con caracteres especiales

- **Given** `user.name = "María José García"`
- **When** se slugifica
- **Then** devuelve `"maria-jose-garcia"`.

### Scenario: colisión

- **Given** ya existe `carlos-mendoza` en `users.username`
- **When** se crea un nuevo `Carlos Mendoza`
- **Then** `resolveAvailableUsername` devuelve `carlos-mendoza-2`.

### Scenario: límite de 20 chars

- **Given** un nombre cuyo slug supera 20 caracteres
- **When** se slugifica
- **Then** se trunca a 20 chars y no termina en `-`.

## Requirement 2: Ruta pública `/u/[username]`

### Scenario: username válido

- **Given** un user con `username = "carlos-mendoza"`
- **When** se navega a `/es/u/carlos-mendoza`
- **Then** se renderiza la página de perfil (sin requerir sesión).

### Scenario: username inexistente

- **Given** ningún user con `username = "no-existe"`
- **When** se navega a `/u/no-existe`
- **Then** Next.js sirve la página 404 (`notFound()`).

### Scenario: visitante anónimo puede verlo

- **Given** un visitante sin sesión
- **When** carga `/u/<username>`
- **Then** ve identidad + stats + catálogo de logros. No ve email, predicciones específicas ni nada fuera de `docs/public-profile.md`.

## Requirement 3: Identity card

### Scenario: render completo

- **Given** un user `{ name: "Carlos Mendoza", username: "carlos-mendoza", country: "MX", image: "<url>" }`
- **When** se renderiza el hero
- **Then** muestra el avatar (con ring conic), el nombre, `@carlos-mendoza`, una pill con bandera 🇲🇽 + "México", y un botón "Copiar enlace".

### Scenario: sin país

- **Given** `user.country = null`
- **When** se renderiza
- **Then** la country pill no aparece. Lo demás sigue igual.

### Scenario: copiar enlace

- **Given** el visitante está en `/u/carlos-mendoza`
- **When** pulsa "Copiar enlace"
- **Then** la URL completa se copia al clipboard y aparece un feedback "Copiado" durante 2s.

## Requirement 4: Stats row

### Scenario: rank y puntos

- **Given** `stats = { rank: 42, totalPlayers: 12480, points: 1840, pointsDelta: null }`
- **When** se renderiza
- **Then** muestra "#42" con subtítulo "de 12.480 jugadores" + "1.840 puntos".

### Scenario: user sin actividad

- **Given** `stats.rank = null` (user sin entries en `userPoints`)
- **When** se renderiza
- **Then** muestra "—" en rank y "0" en puntos.

## Requirement 5: Achievements accordion

### Scenario: cerrado por defecto

- **Given** la página recién cargada
- **When** el visitante mira el bloque de logros
- **Then** está cerrado, mostrando solo "X de 24 desbloqueados" + mini-progress.

### Scenario: abrir

- **Given** el acordeón cerrado
- **When** el visitante hace click en el trigger
- **Then** se expande mostrando barra de progreso + secciones por tier en este orden: común, raro, épico, legendario, mítico, GOAT.

### Scenario: card unlocked

- **Given** un logro `first-hit` desbloqueado
- **When** se renderiza
- **Then** muestra el icono + título + descripción a color (no greyscale), con check verde.

### Scenario: card locked

- **Given** un logro `the-goat` no desbloqueado
- **When** se renderiza
- **Then** muestra greyscale + icono lock en lugar del icono real. La descripción sigue visible (para que el visitante sepa qué intenta lograr).

### Scenario: share-chip en tiers altos

- **Given** un logro `tier in [legendary, mythic, goat]` desbloqueado, hover/focus sobre la card
- **When** se renderiza
- **Then** aparece un `share-chip` con el texto "Compartir logro" enlazando a `/u/<username>#ach-<id>`. Para tiers `common`/`rare`/`epic` el chip nunca aparece.

## Requirement 6: Link "Mi perfil" en AccountMenu

### Scenario: user con username

- **Given** una sesión con `user.username = "carlos-mendoza"`
- **When** se renderiza el `AccountMenu`
- **Then** el dropdown tiene un item "Mi perfil" como primer elemento (antes de FAQ) enlazando a `/u/carlos-mendoza`.

### Scenario: username null

- **Given** una sesión con `user.username = null` (race condition o usuario antiguo)
- **When** se renderiza el `AccountMenu`
- **Then** el item "Mi perfil" NO se muestra (degradación silenciosa); el resto del menú funciona igual.

### Scenario: visitante anónimo

- **Given** la home pública sin sesión
- **When** el JoinCta abre el modal
- **Then** no hay item "Mi perfil" (el AccountMenu solo se monta con sesión).

## Requirement 7: i18n

### Scenario: 4 locales

- **Given** los locales `es`, `en`, `fr`, `ar`
- **When** se carga el perfil
- **Then** los mensajes `publicProfile.*` están traducidos en los cuatro JSON sin claves faltantes.

### Scenario: RTL en árabe

- **Given** locale `ar`
- **When** se renderiza el perfil
- **Then** el ring del avatar, la pill de país y los chips se reorientan vía clases lógicas (`start-/end-`, `ms-/me-`). Los emojis de bandera no se voltean.
