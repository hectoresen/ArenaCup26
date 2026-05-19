# Purpose

Persistir y reconciliar `ProviderMatch[]` en las tablas `teams` y `matches` de la BD, sin sobreescribir estados controlados por la app y siendo idempotente.

# Requirements

## Requirement 1: Mapping de externalIds

Cada provider mantiene su propio espacio de IDs; la BD usa UUIDs.

### Scenario: `team_external_ids` resuelve un externalId

- **Given** una fila `(team_id="uuid-arg", source="api-football", external_id="6")` en `team_external_ids`
- **When** se llama `loadTeamMap(db, "api-football")`
- **Then** el `Map` devuelto contiene `{"6" → "uuid-arg"}`.

### Scenario: equipo no mapeado

- **Given** un `ProviderMatch` cuyo `homeTeam.externalId` no está en `team_external_ids`
- **When** se reconcilia
- **Then** el resultado es `{ kind: "skip", reason: "team_not_mapped", externalId, teamLabel: "home" }`.

## Requirement 2: Reconciler puro

`reconcileMatch(current, snapshot, teamMap)` es una pure function que decide qué escribir.

### Scenario: insert nuevo

- **Given** `current = null` y un snapshot completo con teams mapeados y stage resuelto
- **When** se reconcilia
- **Then** devuelve `{ kind: "insert", row: { stage, homeTeamId, awayTeamId, kickoffAt, status, scores } }`.

### Scenario: idempotencia (fila ya está al día)

- **Given** un `current` cuyos campos coinciden exactamente con el snapshot adaptado
- **When** se reconcilia
- **Then** devuelve `{ kind: "noop" }`.

### Scenario: prediction-locked no retrocede

- **Given** `current.status = "prediction-locked"` y snapshot con `status = "scheduled"`
- **When** se reconcilia
- **Then** el patch resultante mantiene `status = "prediction-locked"` (no lo sobreescribe).

### Scenario: status promotion

- **Given** `current.status = "scheduled"` y snapshot con `status = "live"`
- **When** se reconcilia
- **Then** el patch incluye `status = "live"`.

### Scenario: cancelled tras live

- **Given** `current.status = "live"` y snapshot con `status = "cancelled"`
- **When** se reconcilia
- **Then** el patch incluye `status = "cancelled"` y `homeScore`/`awayScore` quedan como estaban (no se borran).

### Scenario: scores actualizados

- **Given** `current.homeScore = 1, awayScore = 0` y snapshot con `scoreAt90 = {home: 2, away: 0}`
- **When** se reconcilia
- **Then** el patch incluye `homeScore = 2, awayScore = 0`.

### Scenario: penaltyWinner mapeado a UUID

- **Given** snapshot con `penaltyWinner = "home"` y homeTeamId resuelto a `"uuid-arg"`
- **When** se reconcilia
- **Then** el patch incluye `penaltyWinnerTeamId = "uuid-arg"`.

### Scenario: stage null

- **Given** snapshot con `stage = null` (round desconocido del provider)
- **When** se reconcilia
- **Then** devuelve `{ kind: "skip", reason: "stage_unresolved", externalId }`.

## Requirement 3: Mapeo de status provider → DB

`ProviderMatchStatus` (10 valores) colapsa al enum `match_status` (7 valores) con esta tabla:

### Scenario: tabla de mapeo de status

- **Given** los `ProviderMatchStatus` valores
- **When** se llama `providerToDbStatus`
- **Then** mapean según:
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

(Nota: el enum DB tiene además `scheduled-tbd` y `prediction-locked` que el provider nunca produce; son estados internos.)

## Requirement 4: Orquestador `syncFixtures`

`syncFixtures({ db, provider, leagueId, season })` es el punto de entrada; devuelve un `SyncReport`.

### Scenario: lote completo nuevo

- **Given** una BD vacía con team mapping ya sembrado y un provider que devuelve 64 partidos
- **When** se llama `syncFixtures`
- **Then** el reporte tiene `inserted: 64, updated: 0, skipped: 0, errors: []`.

### Scenario: lote idempotente

- **Given** una BD ya sincronizada con el último output del provider
- **When** se llama `syncFixtures` de nuevo
- **Then** el reporte tiene `inserted: 0, updated: 0, skipped: 0`.

### Scenario: error en un partido no aborta el lote

- **Given** un lote de 64 partidos, uno con `stage = null`
- **When** se llama `syncFixtures`
- **Then** los otros 63 se procesan y el reporte tiene `skipped: 1, errors: [{ externalId, reason: "stage_unresolved" }]`.

### Scenario: provider lanza ProviderError

- **Given** el provider lanza `ProviderError({ code: "rate_limited" })`
- **When** se llama `syncFixtures`
- **Then** el error se propaga al caller (no se silencia: el caller decide retry/backoff).

## Requirement 5: Endpoint cron protegido

`POST /api/cron/sync-fixtures` con bearer token.

### Scenario: token correcto

- **Given** `CRON_SECRET = "abc"` en env y header `Authorization: Bearer abc`
- **When** se hace POST al endpoint
- **Then** ejecuta `syncFixtures` y responde `200` con el `SyncReport` JSON.

### Scenario: token ausente o incorrecto

- **Given** header ausente, vacío, o con un token distinto
- **When** se hace POST al endpoint
- **Then** responde `401` con body `{ error: "unauthorized" }`.

### Scenario: provider falla

- **Given** el provider lanza `ProviderError({ code: "auth_failed" })`
- **When** el handler procesa
- **Then** responde `502` con `{ error: "provider_failed", code: "auth_failed" }`. El siguiente cron tick reintenta automáticamente.
