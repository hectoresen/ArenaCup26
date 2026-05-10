# Purpose

Sembrar la BD con un dataset histórico del Mundial Qatar 2022: 32 selecciones y 24 partidos (los 16 de eliminatoria completos + 8 representativos de grupos). Da material realista para validar el scoring engine, el leaderboard y, cuando aterrice, la pipeline en vivo, sin esperar al 11 de junio.

# Requirements

## Requirement 1: Catálogo de las 32 selecciones

`WC2022_TEAMS` exporta los 32 equipos que disputaron Qatar 2022.

### Scenario: Tamaño y unicidad

- **Given** el array `WC2022_TEAMS`
- **When** se inspecciona
- **Then** tiene `length === 32` y todos los `code` son únicos.

### Scenario: Códigos FIFA de 3 letras mayúsculas

- **Given** cualquier equipo del catálogo
- **When** se valida su `code`
- **Then** matchea `^[A-Z]{3}$`.

### Scenario: Distribución por grupos

- **Given** el catálogo
- **When** se cuenta por `group`
- **Then** los grupos A-H tienen exactamente 4 equipos cada uno.

### Scenario: Finalistas presentes

- **Given** el catálogo
- **When** se buscan los códigos
- **Then** ARG, FRA, CRO y MAR están todos presentes (los 4 semifinalistas).

## Requirement 2: 24 partidos con casos icónicos cubiertos

`WC2022_MATCHES` incluye los 16 partidos de eliminatoria + 8 representativos de grupos.

### Scenario: Eliminatoria completa

- **Given** el array
- **When** se filtran los partidos no-grupo
- **Then** hay 8 round-of-16, 4 cuartos, 2 semis, 1 tercer puesto y 1 final.

### Scenario: La final ARG-FRA con penaltis

- **Given** el partido `wc2022-final-arg-fra`
- **When** se consulta
- **Then** `scoreAtExtra` es `{ home: 3, away: 3 }` y `penaltyWinnerCode === "ARG"`.

### Scenario: Upset Saudí sobre Argentina

- **Given** el partido `wc2022-grpC-arg-ksa`
- **When** se consulta
- **Then** `scoreAt90` es `{ home: 1, away: 2 }` (Argentina home pierde 1-2).

### Scenario: Croacia gana dos penaltis

- **Given** los partidos `wc2022-r16-jpn-cro` y `wc2022-qf-cro-bra`
- **When** se consulta `penaltyWinnerCode`
- **Then** ambos son `"CRO"`.

## Requirement 3: Consistencia interna del fixture

Cada partido referencia equipos válidos del catálogo y respeta las reglas de eliminatoria/penaltis.

### Scenario: Equipos referenciados existen

- **Given** cualquier partido
- **When** se valida
- **Then** `homeCode`, `awayCode` y, si está, `penaltyWinnerCode` corresponden a equipos del catálogo. `penaltyWinnerCode` es siempre `homeCode` o `awayCode`.

### Scenario: scoreAtExtra solo en knockouts

- **Given** un partido con `scoreAtExtra` no nulo
- **When** se valida
- **Then** su `stage` no es `group`.

### Scenario: penaltyWinner solo cuando hubo empate al 120'

- **Given** un partido con `penaltyWinnerCode` no nulo
- **When** se valida
- **Then** `scoreAtExtra` no es null y `scoreAtExtra.home === scoreAtExtra.away`.

## Requirement 4: Seed idempotente sobre teams, destructivo sobre matches

`seedWC2022(db)` se puede ejecutar varias veces. Las teams quedan sincronizadas (upsert por code); las matches se truncan y reinsertan limpias.

### Scenario: Run sobre BD vacía

- **Given** la BD sin teams ni matches
- **When** se ejecuta `seedWC2022(db)`
- **Then** la respuesta es `{ teams: 32, matches: 24 }` y la BD contiene esas filas.

### Scenario: Re-run idempotente

- **Given** la BD ya seedada con WC 2022
- **When** se ejecuta de nuevo
- **Then** las matches se truncan y reinsertan; las teams se upserten (mismos IDs por code, fields refrescados); la respuesta es la misma.

## Requirement 5: Integración con el scoring engine

El fixture y el motor coexisten sin desincronización: el motor sabe puntuar cualquier partido del fixture.

### Scenario: Predicción simple correcta puntúa 10

- **Given** cualquier partido del fixture y la predicción simple del ganador real
- **When** se invoca `scoreMatchPrediction`
- **Then** el resultado es `{ points: 10, kind: "simple", … }`.

### Scenario: Predicción exacta correcta puntúa 30

- **Given** cualquier partido del fixture y la predicción exacta del marcador oficial (90' en grupos, 120' en knockouts con prórroga)
- **When** se invoca el engine
- **Then** el resultado es `{ points: 30, kind: "exact", … }`.

### Scenario: Final 3-3 con exact prediction

- **Given** la final ARG-FRA (3-3 en prórroga, ARG gana penaltis 4-2) y la predicción exacta `home: 3, away: 3`
- **When** se invoca el engine
- **Then** `points === 30` (los penaltis no mueven el marcador para la regla de exacto).

## Requirement 6: Comando CLI

`npm run seed:wc2022` ejecuta el seed con un aviso de destructividad.

### Scenario: Run con BD disponible

- **Given** Postgres corriendo y `DATABASE_URL` configurada
- **When** se ejecuta `npm run seed:wc2022`
- **Then** el script imprime "Seeding WC 2022…", "⚠️  Esto borra predictions y matches existentes.", luego "✓ Inserted 32 teams and 24 matches.", y `process.exit(0)`.

### Scenario: Run con BD inaccesible

- **Given** Postgres no disponible
- **When** se ejecuta el script
- **Then** falla con error de conexión, imprime "[wmundial] seed:wc2022 failed:" y `process.exit(1)`.
