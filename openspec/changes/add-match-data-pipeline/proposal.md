# add-match-data-pipeline

## Why

`add-match-data-providers` (round a) entrega un `MatchDataProvider` que devuelve `ProviderMatch[]`. `add-data-model` define las tablas `teams` y `matches` con UUIDs internos. **No hay nada que conecte ambos**: el `ProviderMatch.homeTeam.externalId = "6"` (api-football) tiene que resolverse al `teams.id = "uuid-de-argentina"`, y los snapshots tienen que persistirse en `matches` con upsert. Sin esto, el día del Mundial seguimos metiendo marcadores a mano.

## What changes

Capability nueva: **`match-data-pipeline`**.

### Schema delta

- Nueva tabla `team_external_ids`: `(team_id uuid, source text, external_id text, primary key (source, external_id))`. Permite múltiples providers por equipo sin tocar `teams`.
- Nueva tabla `match_external_ids`: misma forma, indexada por `(source, external_id)`. Necesaria para que el upsert sepa qué fila actualizar.
- Migración Drizzle aditiva (no destructiva).

### Lógica pura (testeable sin DB)

`src/server/match-data/sync/reconcile.ts`:

- `reconcileMatch(current: MatchRow | null, snapshot: ProviderMatch, teamMap)` → `MatchPatch | "skip"`. Decide qué columnas escribir y qué dejar como están.
- Reglas:
  - Si `current` es null → insert con todas las columnas del snapshot.
  - Si `current.status === "prediction-locked"` y el snapshot dice `scheduled` → mantener `prediction-locked` (no retroceder).
  - Si snapshot trae `live`/`finished`/`postponed`/`cancelled` → sobreescribir.
  - Si los scores cambian → escribirlos. Si no cambian → no.
  - `homeTeamId`/`awayTeamId` se resuelven via `teamMap` (lookup `(source, externalId) → uuid`); si falta, `"skip"` con razón `"team_not_mapped"`.
  - `stage` debe estar resuelto en el snapshot; si es null el reconciler retorna `"skip"`.

`src/server/match-data/sync/team-mapping.ts`:

- `loadTeamMap(db, source)`: lee `team_external_ids` y devuelve `Map<externalId, teamId>`.
- Pure helpers para mapear `ProviderMatchStatus → matchStatusEnum` (incluye degradación: live/extra_time/penalty_shootout → live; abandoned → cancelled).

### Orquestador

`src/server/match-data/sync/sync.ts`:

- `syncFixtures({ db, provider, leagueId, season }) → SyncReport`. Llama `provider.getFixtures()`, carga el team map, hace upsert por cada snapshot vía `reconcileMatch`, devuelve un reporte con `inserted/updated/skipped` y errores acumulados.
- Idempotente: ejecutar dos veces seguidas con el mismo input no debe escribir nada la segunda vez.
- Best-effort: un error en un partido no aborta el batch.

### Endpoint cron

`src/app/api/cron/sync-fixtures/route.ts`:

- `POST /api/cron/sync-fixtures` con header `Authorization: Bearer ${CRON_SECRET}`.
- Llama `syncFixtures` con la config del league/season actual (env-driven).
- Devuelve el `SyncReport` como JSON; loggea siempre.

`vercel.json`:

- Cron `*/5 * * * *` durante el Mundial (configurable).

### Tests

- **reconcile** (~20 cases): null current, scores idénticos, prediction-locked no retrocede, status promotion, team_not_mapped, stage null skip, penaltyWinner mapping, cancelled tras scheduled, etc.
- **team-mapping** (~6 cases): map vacío, múltiples sources, status mapping table.
- **sync orquestador** con `db` mockeado (interfaz mínima `MatchRepo`): inserción nueva, update parcial, skip por mapping faltante, agregación de SyncReport.
- **integration** (`describe.skipIf(!process.env.DATABASE_URL_TEST)`): contra una DB Postgres real (docker-compose), siembra teams + match_external_ids, ejecuta `syncFixtures` con un provider stub, valida fila en `matches`. Usa transacción rollback al final.

**No incluye**:

- Re-cálculo de puntos cuando un partido cambia (eso lo hace `add-scoring-pipeline`).
- Backfill manual de partidos pasados (eso lo hace `add-fixture-seed-wc2022` para Qatar; en producción 2026 no aplica).
- Auto-creación de `team_external_ids`. La primera vez se siembra a mano (junto a `add-fixture-seed-wc2026` cuando aterrice). El pipeline asume que el mapping ya existe.

## Impact

- **Bloquea**: `add-leaderboard-sse` (necesita partidos vivos en BD); `add-scoring-pipeline` (re-cálculo cuando un match cambia).
- **Desbloquea**: el flujo end-to-end de "marcador real → BD → puntos".
- **Riesgos**:
  - Cron en Vercel Hobby tiene límite de 2 jobs y ~10 invocaciones diarias. El plan Pro lo soluciona; durante desarrollo correr a mano vía script.
  - Si el provider devuelve `stage: null` (round string desconocido), el partido se ignora. Detectable vía SyncReport.errors.
- **Decisiones cerradas**:
  - Mapeo team-by-team via tabla intermedia `team_external_ids`. Razón: round (b) trae LiveScoreApiProvider con sus propios IDs y no queremos columna por provider.
  - `prediction-locked` es un estado controlado por la app, no por el provider. El reconciler nunca lo sobreescribe con `scheduled`.
  - El reconciler es pure function. La I/O (lectura de `current`, escritura del patch) vive en `syncFixtures`. Se puede testear el grueso de la lógica sin DB.
