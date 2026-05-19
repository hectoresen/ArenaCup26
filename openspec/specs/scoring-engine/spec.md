# Purpose

Implementar el motor de puntuación de ArenaCup26 como una **función pura** que, dado el resultado oficial de un partido, una predicción de usuario y el estado de su racha, devuelve los puntos a sumar, el tipo de evento, la racha resultante y los bonus de combo disparados. Sin BD, sin I/O, totalmente testeable.

# Requirements

## Requirement 1: Estados anulados preservan la racha

Cuando el partido no está en estado `finished`, la predicción no se evalúa: el resultado es `voided`, 0 puntos, racha intacta.

### Scenario: Partido cancelado

- **Given** un usuario con racha `{ current: 5, containsDouble: false }`
- **When** se invoca el engine sobre un partido cancelado
- **Then** el resultado es `{ points: 0, kind: "voided", streakAfter: { current: 5, containsDouble: false }, comboBonuses: [] }`.

### Scenario: Partido pospuesto

- **Given** la misma racha
- **When** el partido está pospuesto
- **Then** mismo resultado voided, racha intacta.

### Scenario: Defensa en profundidad — finished sin scores

- **Given** un partido marcado como `finished` pero `scoreAt90` y `scoreAtExtra` son null
- **When** se invoca el engine
- **Then** devuelve voided (datos inconsistentes), no resetea ni incrementa la racha.

## Requirement 2: Acierto simple en grupos

En fase de grupos, una predicción `kind = simple` con el ganador (o empate) correcto otorga +10 puntos.

### Scenario: Predicción home, gana home

- **Given** un partido de grupos 2-1
- **When** la predicción es `simple home`
- **Then** se otorgan **10 puntos**, kind `simple`, streak +1.

### Scenario: Predicción draw, hay empate

- **Given** un partido de grupos 1-1
- **When** la predicción es `simple draw`
- **Then** se otorgan **10 puntos**.

### Scenario: Predicción home, hay empate

- **Given** un partido de grupos 1-1
- **When** la predicción es `simple home`
- **Then** miss, 0 puntos, racha resetea a 0.

## Requirement 3: Acierto exacto

`kind = exact` evalúa el marcador completo. Sin fallback a simple si el ganador era correcto pero el marcador no.

### Scenario: Predicción 2-1, marcador 2-1

- **Given** un partido 2-1
- **When** la predicción exacta es 2-1
- **Then** se otorgan **30 puntos**, kind `exact`.

### Scenario: Predicción 2-1, marcador 3-0 (mismo ganador, distinto distribución)

- **Given** un partido 3-0
- **When** la predicción exacta es 2-1
- **Then** miss, 0 puntos. **No** hay fallback a simple +10.

### Scenario: Predicción 0-0

- **Given** un partido 0-0
- **When** la predicción exacta es 0-0
- **Then** se otorgan **30 puntos**.

## Requirement 4: Doble predicción

`kind = double-1x | double-x2 | double-12` cubre dos resultados de los tres posibles. Si el ganador oficial cae dentro de la cobertura, +5 puntos.

### Scenario: 1X cubre home y draw

- **Given** un partido 2-0 (home gana)
- **When** la predicción es `double-1x`
- **Then** se otorgan **5 puntos**, kind `double`, racha +1 con `containsDouble = true`.

### Scenario: 1X NO cubre away

- **Given** un partido 0-2 (away gana)
- **When** la predicción es `double-1x`
- **Then** miss.

### Scenario: 12 falla en empate

- **Given** un partido 1-1 (empate)
- **When** la predicción es `double-12`
- **Then** miss (12 cubre home y away, no empate).

## Requirement 5: Eliminatoria — marcador exacto al final de la prórroga

En partidos de eliminatoria que llegan a prórroga, `scoreAtExtra` es el marcador oficial para `exact`. Los penaltis NO suman al marcador.

### Scenario: Argentina-Francia 3-3 + penaltis

- **Given** un partido eliminatoria 3-3 al final de la prórroga, ganando home por penaltis
- **When** la predicción exacta es 3-3
- **Then** se otorgan **30 puntos**.

### Scenario: Predicción 4-3 en Argentina-Francia 3-3 + penaltis

- **Given** el mismo partido
- **When** la predicción exacta es 4-3
- **Then** miss (penaltis no suman al marcador).

### Scenario: Exact al 90' falla si la prórroga cambió el marcador

- **Given** un partido 1-1 al 90', 2-1 tras prórroga
- **When** la predicción exacta es 1-1
- **Then** miss (el marcador oficial es 2-1).

## Requirement 6: Eliminatoria — ganador oficial incluye penaltis

`kind = simple` evalúa el ganador oficial, que puede venir de penaltyWinner.

### Scenario: Predicción home, gana por penaltis

- **Given** un partido 1-1 al 120', penaltyWinner = home
- **When** la predicción es `simple home`
- **Then** se otorgan **10 puntos**.

### Scenario: Predicción draw en eliminatoria SIEMPRE falla

- **Given** cualquier partido eliminatoria con penaltyWinner seteado
- **When** la predicción es `simple draw`
- **Then** miss (en eliminatoria no hay empate oficial).

### Scenario: Doble 12 siempre acierta en eliminatoria con ganador

- **Given** cualquier partido eliminatoria con un ganador (outright o por penaltis)
- **When** la predicción es `double-12`
- **Then** se otorgan **5 puntos** (12 cubre home y away, y siempre uno gana en eliminatoria).

## Requirement 7: Combos a hitos 3, 5, 10

Cuando la racha cruza un hito (3, 5 o 10), se añade un bonus al total. Si la racha contiene al menos una doble acertada, el bonus es el reducido.

### Scenario: Cruce a hito 3 sin dobles

- **Given** racha `{ current: 2, containsDouble: false }`
- **When** la predicción acierta (un simple +10)
- **Then** total = 10 + 5 = **15 puntos**, comboBonuses = [{ milestone: 3, points: 5 }].

### Scenario: Cruce a hito 3 con dobles previas

- **Given** racha `{ current: 2, containsDouble: true }`
- **When** la predicción acierta (un simple +10)
- **Then** total = 10 + 3 = **13 puntos**, comboBonuses = [{ milestone: 3, points: 3 }].

### Scenario: Cruce a hito 10 sin dobles

- **Given** racha `{ current: 9, containsDouble: false }`
- **When** la predicción acierta (un simple +10)
- **Then** total = 10 + 50 = **60 puntos**.

### Scenario: Cruce a hito 10 con dobles

- **Given** racha `{ current: 9, containsDouble: true }`
- **When** la predicción acierta (un exact +30)
- **Then** total = 30 + 9 = **39 puntos**.

### Scenario: Sin combo entre hitos

- **Given** racha `{ current: 6, containsDouble: false }`
- **When** la predicción acierta
- **Then** total = 10, comboBonuses = [].

### Scenario: Sin combo más allá de 10

- **Given** racha `{ current: 15, containsDouble: false }`
- **When** la predicción acierta
- **Then** total = 10, comboBonuses = [] (no hay nuevos hitos por encima de 10).

## Requirement 8: Transiciones de racha

La racha se actualiza según el tipo de hit.

### Scenario: Hit incrementa la racha

- **Given** racha `{ current: 4, containsDouble: false }`
- **When** un simple acierta
- **Then** `streakAfter = { current: 5, containsDouble: false }`.

### Scenario: Doble propaga `containsDouble = true`

- **Given** racha `{ current: 3, containsDouble: false }`
- **When** una doble acierta
- **Then** `streakAfter = { current: 4, containsDouble: true }`.

### Scenario: Simple posterior preserva `containsDouble`

- **Given** racha `{ current: 4, containsDouble: true }`
- **When** un simple acierta
- **Then** `streakAfter = { current: 5, containsDouble: true }`.

### Scenario: Miss resetea racha completa

- **Given** racha `{ current: 7, containsDouble: true }`
- **When** la predicción falla
- **Then** `streakAfter = { current: 0, containsDouble: false }`.

### Scenario: Voided preserva racha

- **Given** racha `{ current: 7, containsDouble: true }`
- **When** el partido se cancela
- **Then** `streakAfter = { current: 7, containsDouble: true }`.

## Requirement 9: Doble en racha cuenta para el combo del cruce

Si una doble acertada es la que dispara el cruce de hito, el bonus aplica con la tabla modificada (porque la racha tras el cruce contiene la doble recién añadida).

### Scenario: Doble acertada cruzando a hito 3

- **Given** racha `{ current: 2, containsDouble: false }`
- **When** una doble acierta (kind = double-1x sobre 2-0)
- **Then** total = 5 + 3 = **8 puntos** (doble base +5, combo modificado +3 porque la racha tras el cruce ya contiene la doble).
