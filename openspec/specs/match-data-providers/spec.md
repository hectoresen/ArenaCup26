# Purpose

Integrar la primera fuente externa de datos de partidos (api-football) detrás de una interfaz `MatchDataProvider` provider-agnóstica. Cualquier consumidor del scoring engine recibe `MatchOutcome` sin saber qué proveedor concreto los originó. Sienta la base para añadir un secundario (Live-Score-API) sin tocar el resto del código.

# Requirements

## Requirement 1: Interfaz `MatchDataProvider` estable

Cualquier proveedor expone una interfaz mínima conocida.

### Scenario: ApiFootballProvider implementa la interfaz

- **Given** el módulo `src/server/match-data/providers/api-football.ts`
- **When** se importa `createApiFootballProvider`
- **Then** la factory devuelve un objeto con `name: "api-football"` y un método `getFixtures({ leagueId, season })` que devuelve `Promise<ProviderMatch[]>`.

## Requirement 2: Parser de api-football

`parseApiFootballFixture(raw, fetchedAt)` convierte el shape nativo en un `ProviderMatch` normalizado, sin I/O.

### Scenario: Final WC 2022 (3-3 ARG-FRA, penaltis ARG)

- **Given** el shape real de la final capturado en sandbox 2026-05-10
- **When** se pasa por el parser
- **Then** el resultado tiene `status: "finished"`, `stage: "final"`, `scoreAt90: {home:2, away:2}`, `scoreAtExtra: {home:3, away:3}` (CUMULATIVO, no los goles solo de la prórroga), `penaltyWinner: "home"`, `homeTeam.name: "Argentina"`.

### Scenario: Partido decidido en prórroga sin penaltis

- **Given** un fixture con `status.short = "AET"`, `score.fulltime = {home:2, away:2}`, `score.extratime = {home:1, away:0}`, `goals = {home:3, away:2}`, `score.penalty = {home:null, away:null}`
- **When** se parsea
- **Then** `status = "finished"`, `scoreAt90 = {home:2, away:2}`, `scoreAtExtra = {home:3, away:2}`, `penaltyWinner = null`.

### Scenario: Partido decidido en 90'

- **Given** `status.short = "FT"`, `score.fulltime = {home:4, away:1}`, `score.extratime = {home:null, away:null}`
- **When** se parsea
- **Then** `scoreAt90 = {home:4, away:1}` y `scoreAtExtra = null`.

### Scenario: Partido en vivo

- **Given** `status.short = "2H"`, `score.fulltime = {home:null, away:null}`, `goals = {home:2, away:1}`
- **When** se parsea
- **Then** `status = "live"` y `scoreAt90 = null` (todavía no es final).

### Scenario: Partido pospuesto

- **Given** `status.short = "PST"`, todos los scores null
- **When** se parsea
- **Then** `status = "postponed"`, todos los scores null.

### Scenario: Round string a stage

- **Given** los strings nativos: `"Group A - 1"`, `"Round of 16"`, `"1/8 Finals"`, `"Quarter-finals"`, `"Semi-finals"`, `"3rd Place Final"`, `"Final"`
- **When** se pasan por `parseStage`
- **Then** mapean a `"group"`, `"round-of-16"`, `"round-of-16"`, `"quarter"`, `"semi"`, `"third-place"`, `"final"` respectivamente.

### Scenario: Round string desconocido

- **Given** `"Friendly"` o `null`
- **When** se pasa por `parseStage`
- **Then** devuelve `null`.

## Requirement 3: HTTP, autenticación y manejo de errores

`createApiFootballProvider` golpea la API con header `x-apisports-key` y mapea fallos a errores tipados.

### Scenario: Header de autenticación correcto

- **Given** un provider creado con `apiKey: "test-key"`
- **When** se llama `getFixtures({ leagueId: 1, season: 2022 })`
- **Then** la request HTTP incluye `x-apisports-key: test-key` y la URL es `${baseUrl}/fixtures?league=1&season=2022`.

### Scenario: Plan limitado del envelope

- **Given** la API responde 200 con `errors: { plan: "Free plans do not have access to this season..." }`
- **When** el provider procesa la respuesta
- **Then** lanza `ProviderError` con `code = "plan_limited"` y `source = "api-football"`.

### Scenario: HTTP 401 → auth_failed

- **Given** la API responde con `401 Unauthorized`
- **When** el provider procesa
- **Then** lanza `ProviderError` con `code = "auth_failed"` y `httpStatus = 401`.

### Scenario: HTTP 429 → rate_limited

- **Given** la API responde con `429 Too Many Requests`
- **When** el provider procesa
- **Then** lanza `ProviderError` con `code = "rate_limited"`.

### Scenario: Error de red

- **Given** el `fetcher` lanza una excepción (DNS, ECONNREFUSED, etc.)
- **When** el provider llama a la API
- **Then** lanza `ProviderError` con `code = "network_error"` envolviendo el error original en `details`.

## Requirement 4: Adapter a `MatchOutcome`

`toMatchOutcome(providerMatch)` convierte el snapshot del provider al input del scoring engine.

### Scenario: Mapeo de status

- **Given** `ProviderMatchStatus` valores
- **When** se adaptan
- **Then** mapean según la tabla:
  - `scheduled` → `scheduled`
  - `live` → `live`
  - `extra_time` → `live`
  - `penalty_shootout` → `live`
  - `finished` → `finished`
  - `postponed` → `postponed`
  - `cancelled` → `cancelled`
  - `abandoned` → `cancelled`
  - `interrupted` → `live`
  - `unknown` → `scheduled`

### Scenario: Preservación de scores

- **Given** un `ProviderMatch` con `scoreAt90`, `scoreAtExtra` y `penaltyWinner`
- **When** se adapta
- **Then** los tres campos se copian verbatim al `MatchOutcome`.

### Scenario: Stage null lanza error

- **Given** un `ProviderMatch` con `stage: null` (round desconocido)
- **When** se adapta
- **Then** se lanza un `Error` con mensaje que incluye `externalId`, `source` y `roundLabel` para que el caller pueda diagnosticar.

## Requirement 5: Integración end-to-end con el scoring engine

El pipeline completo (parser → adapter → engine) entrega los puntos correctos sobre un dataset real.

### Scenario: Predicción simple correcta sobre la final WC 2022

- **Given** el shape real de la final WC 2022 parseado y adaptado
- **When** se aplica una predicción `simple` con `predictedWinner: "home"` (Argentina ganó por penaltis)
- **Then** el scoring engine devuelve `points: 10`, `kind: "simple"`.

### Scenario: Predicción exacta correcta sobre la final WC 2022

- **Given** la misma final
- **When** se aplica una predicción `exact` con `3-3` (cumulativo al final de la prórroga)
- **Then** el engine devuelve `points: 30`, `kind: "exact"` (los penaltis no mueven el marcador).

### Scenario: Predicción 'draw' falla en eliminatoria

- **Given** la misma final
- **When** se aplica `simple` con `predictedWinner: "draw"`
- **Then** el engine devuelve `kind: "miss"` (en eliminatoria no hay empate oficial).

## Requirement 6: Test de integración real opt-in

Un test `describe.skipIf(!process.env.API_FOOTBALL_KEY)` valida la integración real sin romper CI cuando no hay key.

### Scenario: Sin clave en el entorno

- **Given** el entorno de CI sin `API_FOOTBALL_KEY`
- **When** se ejecuta `npm test`
- **Then** los tests offline pasan; el describe de integración se reporta como `skipped`.

### Scenario: Con clave válida en el entorno

- **Given** `API_FOOTBALL_KEY` configurada localmente
- **When** se ejecuta `npm test`
- **Then** el provider golpea `https://v3.football.api-sports.io/fixtures?league=1&season=2022` (1 req del cupo diario), recibe ≥60 fixtures, y la final ARG-FRA aparece con `scoreAt90={home:2,away:2}` y `scoreAtExtra={home:3,away:3}`.
