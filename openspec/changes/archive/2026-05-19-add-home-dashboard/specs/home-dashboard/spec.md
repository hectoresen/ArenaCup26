# Purpose

La página `/inicio` del área logada: el primer destino tras el login. Resumen del estado del usuario (puntos, racha, logros) + partido en vivo o próximo + lista de próximos + progreso (logros / ranking) + mini-leaderboard.

# Requirements

## Requirement 1: Ruta y guard

La página vive en el route group `(app)` y requiere sesión.

### Scenario: usuario sin sesión

- **Given** un usuario sin sesión activa
- **When** intenta acceder a `/es/inicio`
- **Then** el layout `(app)` redirige a `/es` (cubierto por `add-app-shell`).

### Scenario: usuario logado

- **Given** una sesión válida
- **When** carga `/es/inicio`
- **Then** se renderizan los bloques Hero, LiveSection, Próximos partidos, Tu progreso, Top del momento, en ese orden.

## Requirement 2: Hero personal

Saludo con nombre, ranking #N de T, tres mini-stats.

### Scenario: render del hero

- **Given** `user.name = "Carlos Mendoza"`, `stats = { totalPoints: 1840, streak: 5, achievementsUnlocked: 8, achievementsTotal: 24, rank: 42, totalPlayers: 12480 }`
- **When** se renderiza el `<Hero>`
- **Then** muestra:
  - Saludo `Hola, Carlos 👋` (primer nombre extraído del `user.name`)
  - Subtítulo `Vas el #42 de 12.480 jugadores` (números con separador es-ES)
  - 3 mini-stats: `1.840 Puntos`, `🔥 5 En racha`, `8/24 Logros`.

### Scenario: usuario nuevo sin actividad

- **Given** `stats = { totalPoints: 0, streak: 0, achievementsUnlocked: 0, achievementsTotal: 24, rank: null, totalPlayers: 12480 }`
- **When** se renderiza el `<Hero>`
- **Then** el subtítulo dice `Empieza tu primera predicción` (i18n) y las mini-stats muestran `0`, `Sin racha`, `0/24`.

## Requirement 3: LiveSection — con o sin partido en vivo

La sección decide qué mostrar según el estado de los partidos.

### Scenario: hay un partido en vivo

- **Given** un match con `status = "live"` en BD
- **When** se renderiza `<LiveSection>`
- **Then** el header dice `En vivo ahora` en rojo con dot pulsante y la `<LiveCard>` muestra ese partido.

### Scenario: no hay live, pero hay un próximo partido

- **Given** ningún match en `status = "live"`; el siguiente kickoff es en 4h
- **When** se renderiza `<LiveSection>`
- **Then** el header dice `Próximo partido` (no rojo) y la `<UpcomingHeroCard>` muestra ese partido con countdown.

### Scenario: no hay ningún partido por delante

- **Given** ni live ni próximos
- **When** se renderiza `<LiveSection>`
- **Then** la sección entera no se renderiza (ni header ni card).

## Requirement 4: LiveCard

Muestra marcador, minuto y la predicción del user.

### Scenario: usuario tiene predicción

- **Given** un match `España 2-1 Brasil min 67` y la predicción del user es `España 2-1 Brasil`
- **When** se renderiza `<LiveCard>`
- **Then** muestra el marcador grande, `Min. 67'`, el bloque verde con `Tu predicción: España 2-1 Brasil` y el placeholder `Se calcula al final del partido` (no `+30 pts`).

### Scenario: usuario no predijo

- **Given** un match en vivo sin predicción del user
- **When** se renderiza
- **Then** el bloque verde no aparece; en su lugar aparece un copy `No predijiste este partido`.

### Scenario: placeholder de puntos

- **Given** un live con predicción del user
- **When** se renderiza el bloque de tu predicción
- **Then** muestra el literal `Se calcula al final del partido` con badge azul `info` (no calcula puntos provisionales en este round; eso queda pendiente de `add-live-scoring`).

## Requirement 5: Lista de próximos partidos

Las 5 próximas cards desde `now()`.

### Scenario: tres estados de card

- **Given** una lista de 3 próximos: uno predicho, uno sin predicción, uno TBD (semifinal sin bracket)
- **When** se renderiza la lista
- **Then**:
  - El predicho muestra badge `Enviada` (verde) + texto `<resultado> · Editable`.
  - El no-predicho muestra el botón `Predecir`.
  - El TBD muestra `? vs ?`, copy de fecha + `Equipos por determinar`, sin click (clase `tbd`, `aria-disabled`).

### Scenario: fecha relativa

- **Given** un match con kickoff hoy 21:00
- **When** se renderiza la card
- **Then** la línea meta dice `Hoy · 21:00 h` (i18n).

### Scenario: orden por kickoff ascendente

- **Given** 7 próximos partidos
- **When** se renderiza la lista
- **Then** aparecen las 5 con kickoff más cercano en orden ASC.

## Requirement 6: Tu progreso (logros + posición)

Grid de 2 cards.

### Scenario: card de logros

- **Given** `progress = { achievementsUnlocked: 8, achievementsTotal: 24, lastUnlocked: "Buen Ojo", lastUnlockedAt: <2d ago> }`
- **When** se renderiza la card de logros
- **Then** muestra `8 / 24`, barra animada al ~33% y nota `Último: Buen Ojo · hace 2 d`.

### Scenario: card de posición sin histórico

- **Given** `progress.rank = 42, progress.rankDelta = null, progress.sparkline = null`
- **When** se renderiza la card de ranking
- **Then** muestra `#42`, en lugar de sparkline y delta aparece el copy `Empezamos a registrar el 11 de junio` y el botón `Ver ranking completo`.

### Scenario: card de posición con histórico

- **Given** `progress = { rank: 42, rankDelta: 3, sparkline: [...] }`
- **When** se renderiza la card
- **Then** muestra `#42`, sparkline ascendente y `▲ +3 posiciones esta semana`.

## Requirement 7: Mini-leaderboard

Top 5 + separador + tu fila.

### Scenario: render con los 5 primeros más yo

- **Given** `mini = { top: [5 players], me: { rank: 42, ...} }`
- **When** se renderiza `<MiniLeaderboard>`
- **Then** aparecen 5 filas, un `<hr>` separador y la fila del user con clase `me` y el sufijo `(tú)`.

### Scenario: usuario en el top 5

- **Given** el user es `rank: 3`
- **When** se renderiza
- **Then** la fila del top 5 que coincide con el user aplica la clase `me` y no hay separador ni fila duplicada al final.

## Requirement 8: Floaters decorativos

Los 7 balones flotantes son decoración pura.

### Scenario: usuario sin reduced-motion

- **Given** `prefers-reduced-motion` no está activado
- **When** se monta la página
- **Then** el componente `<Floaters>` añade 7 `<span>` con la animación `floatUp`.

### Scenario: usuario con reduced-motion

- **Given** `prefers-reduced-motion: reduce`
- **When** se monta la página
- **Then** `<Floaters>` no renderiza nada (no añade nodes al DOM).

## Requirement 9: i18n y formato

Los textos cambian con el locale; los números usan el separador local.

### Scenario: locale es

- **Given** locale `es`
- **When** se renderiza el hero con `totalPoints: 4820`
- **Then** la mini-stat muestra `4.820` (separador `.`).

### Scenario: locale en

- **Given** locale `en`
- **When** se renderiza el hero con `totalPoints: 4820`
- **Then** la mini-stat muestra `4,820` (separador `,`).

### Scenario: dirección RTL en árabe

- **Given** locale `ar`
- **When** se renderiza la página
- **Then** los `flex-row` con clases lógicas (`start-/end-`) se reorientan; los emojis de bandera no se voltean.
