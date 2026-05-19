# Purpose

Mostrar el ranking global de jugadores del Mundial 26 como puerta de entrada de la aplicación. El leaderboard es accesible públicamente (sin login) y refleja el estado actual de la competencia: posiciones, puntos oficiales, rachas y aciertos.

# Requirements

## Requirement 1: Página pública en la raíz

La ruta `/` renderiza el leaderboard sin requerir autenticación.

### Scenario: Visitante anónimo accede a la home

- **Given** un visitante sin sesión activa
- **When** navega a `/`
- **Then** ve el leaderboard completo con los 10 primeros jugadores, sin redirección a login.

## Requirement 2: Snapshot inicial del top 10

La página renderiza un snapshot del top 10 en el momento de cargarse.

### Scenario: Render server-side del snapshot

- **Given** una request a `/`
- **When** el servidor genera la página
- **Then** la respuesta HTML incluye los 10 jugadores ordenados por `points` descendente, con sus posiciones (`rank`) calculadas.

## Requirement 3: Podio top-3 visualmente diferenciado

Los tres primeros jugadores se muestran en un podio destacado, separado de la lista del 4-10.

### Scenario: Tratamiento del primer puesto

- **Given** el jugador con `rank = 1`
- **When** se renderiza su `PodiumCard`
- **Then** el card usa el tratamiento gold (`--color-gold`), incluye un balón animado sobre la cabecera, y su altura es ligeramente mayor que p2 y p3.

### Scenario: Tratamiento de puestos 2 y 3

- **Given** los jugadores con `rank = 2` y `rank = 3`
- **When** se renderizan sus `PodiumCard`
- **Then** usan tratamiento `--color-silver` y `--color-bronze` respectivamente, sin crown animado.

## Requirement 4: Lista de filas 4-10 con metadatos

Las posiciones 4-10 se muestran como lista vertical con datos detallados.

### Scenario: Fila estándar

- **Given** un jugador del top 4-10
- **When** se renderiza su `RankRow`
- **Then** muestra: número de posición, indicador de delta (▲/▼/·), bandera con `aria-label` del país, nombre del jugador, racha con icono de fuego si la racha es ≥ 3, badge "✓ N acertadas" con el contador de aciertos, y los puntos totales en gold.

## Requirement 5: Etiqueta "En racha" desde hito 3

El indicador de fuego junto al nick aparece solo cuando el usuario tiene racha ≥ 3 aciertos consecutivos (alineado con `docs/scoring.md`).

### Scenario: Racha menor que 3

- **Given** un jugador con `streak = 2`
- **When** se renderiza su fila
- **Then** la etiqueta de racha NO aparece o muestra "sin racha".

### Scenario: Racha igual o mayor que 3

- **Given** un jugador con `streak = 5`
- **When** se renderiza su fila
- **Then** aparece el icono de fuego + el contador `×5` en color ámbar/naranja.

## Requirement 6: Header del brand

Toda la página usa el header común del brand: trofeo SVG + "We Are 26" + tagline + banderas anfitrionas + pill "Ranking en vivo".

### Scenario: Render del header

- **Given** la página `/` en cualquier estado
- **When** se renderiza
- **Then** aparecen el logo del trofeo, el texto "26" en gold, los emojis de bandera de Canadá, México y USA con `aria-label` correspondientes, y el `LiveBadge`.

## Requirement 7: Accesibilidad

La página cumple criterios básicos de accesibilidad para lectores de pantalla y `prefers-reduced-motion`.

### Scenario: Banderas anunciadas correctamente

- **Given** un jugador con bandera 🇲🇽
- **When** un lector de pantalla recorre su fila
- **Then** anuncia "México" gracias al `aria-label` (el emoji bandera por sí solo no se anuncia).

### Scenario: Movimiento reducido respetado

- **Given** un usuario con `prefers-reduced-motion: reduce` activado
- **When** carga la página
- **Then** todas las animaciones (`popIn`, `floatUp`, `ballSpin`, `trophyFloat`, `blink`) quedan deshabilitadas a duración cero.

## Requirement 8: Datos intercambiables

La fuente de datos del leaderboard está aislada en un módulo intercambiable, de modo que cambiar de mock a BD/SSE no requiera tocar componentes.

### Scenario: Sustitución del proveedor de datos

- **Given** la página `/` que actualmente importa `getInitialSnapshot` de `src/lib/leaderboard/mock.ts`
- **When** se reemplaza esa importación por una función equivalente que consulta la BD o un endpoint
- **Then** los componentes (`LeaderboardView`, `PodiumCard`, `RankRow`) no requieren cambios y el render produce el mismo HTML.
