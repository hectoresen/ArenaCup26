# add-match-data-providers — round (a)

## Why

`add-scoring-engine` calcula puntos a partir de un `MatchOutcome`. `add-fixture-seed-wc2022` siembra datos manualmente. Pero **nada conecta el sistema con una fuente de datos real**. Sin esto, el día del Mundial no sabemos los marcadores hasta que alguien los meta a mano en Postgres.

Esta propuesta arranca la integración con la API real elegida en `docs/match-data-research.md`: **api-football.com** ($19/mes Pro en producción; free tier para tests). El smoke test de 2026-05-10 confirmó que `league_id=1` (FIFA World Cup) tiene `current_season=2026` y que el free tier accede a `season=2022` (Qatar) — perfecto para integration tests sin gastar el plan Pro.

Esta es la **ronda (a)** del plan. Ronda (b) — failover con Live-Score-API — viene después.

## What changes

Capability nueva: **`match-data-providers`**.

### Tipos del dominio (provider-agnósticos)

`src/server/match-data/types.ts`:

- `ProviderMatch`: snapshot normalizado de un partido tal como lo entrega cualquier provider. Carga `externalId`, `source`, equipos, fechas, scores y status.
- `ProviderMatchStatus`: enum normalizado (`scheduled | live | extra_time | penalty_shootout | finished | postponed | cancelled | abandoned | interrupted | unknown`).
- `MatchDataProvider`: interfaz con `name` y `getFixtures({ leagueId, season })`. Cualquier proveedor concreto la implementa.
- `ProviderError`: error tipado con `code: ProviderErrorCode` (`auth_failed | plan_limited | rate_limited | not_found | bad_request | network_error | parse_error | unknown`).

### Parser puro de api-football

`src/server/match-data/providers/api-football.parser.ts`:

- `parseApiFootballFixture(raw, fetchedAt) → ProviderMatch`: pure function. Mapea status codes (`FT/AET/PEN/NS/...`) a `ProviderMatchStatus`, parsea la `round` (`"Final"`, `"Group A - 1"`, etc.) a `MatchStage`, calcula `scoreAtExtra` correctamente.
- **Detalle crítico** descubierto en sandbox: `score.extratime` de api-football solo lleva los goles del periodo de prórroga, no el cumulativo. El cumulativo (lo que necesitamos como `scoreAtExtra`) es `score.fulltime + score.extratime` (equivalente a `goals` en su shape). El parser hace el sum correctamente.
- `parseStage(round)`: helper público para mapear strings de ronda a `MatchStage`. Cubre group, round-of-16 (incluye notación `1/8`), quarter, semi, third-place, final.

### Provider HTTP

`src/server/match-data/providers/api-football.ts`:

- `createApiFootballProvider({ apiKey, baseUrl?, fetcher? })` factory que devuelve un `MatchDataProvider`.
- `getFixtures({ leagueId, season })` golpea `GET /fixtures?league=…&season=…` con header `x-apisports-key`.
- Mapea HTTP status (`401/403 → auth_failed`, `429 → rate_limited`, etc.) y los errors del envelope (campo `errors.plan` → `plan_limited`, `errors.rate*` → `rate_limited`, `errors.token`/`auth*` → `auth_failed`).
- Acepta `fetcher` inyectado para tests sin red.

### Adapter al dominio

`src/server/match-data/adapter.ts`:

- `toMatchOutcome(providerMatch) → MatchOutcome`: convierte el snapshot del provider al input del scoring engine. Mapea `ProviderMatchStatus` → `MatchStatus` del schema (live/extra_time/penalty_shootout colapsan a `live`; abandoned colapsa a `cancelled`).
- Lanza si `stage` es null — el caller decide si ignorar el partido o forzar al provider a clasificar la ronda.

### Tests

- **Parser unit tests** (~30 cases): mapeo exhaustivo de status codes, parsing de stages, extracción de scoreAt90 / scoreAtExtra / penaltyWinner sobre 7 fixtures sintéticos + el shape exacto de la final WC 2022 (capturado en sandbox).
- **Provider tests con fetch mockeado** (~10 cases): URL correcta, header de auth, manejo de errors del envelope, mapeo de HTTP status, network errors, baseUrl con/sin trailing slash.
- **Adapter tests** (~5 cases): mapeo de status, preservación de scores, throw cuando stage es null.
- **End-to-end con scoring engine**: el shape de la final WC 2022 cargado por el parser, adaptado a MatchOutcome, alimentado al scoring engine, devuelve los puntos correctos para predicciones simple/exact/draw.
- **Integration test real** (`describe.skipIf(!process.env.API_FOOTBALL_KEY)`): golpea api-football con la key real para Qatar 2022, verifica >=60 fixtures y que la final ARG-FRA aparece con los datos esperados. Consume 1 req del cupo cuando se ejecuta.

**No incluye**:

- `getLiveFixtures` ni `getFixtureEvents`. Vienen con `add-leaderboard-sse`.
- Adapter desde `ProviderMatch` a una fila para INSERTAR en `matches`. Eso vive en `add-match-data-pipeline` (la cron + el reconciliador), porque requiere mapear team external IDs a UUIDs internos.
- Caching ni retries automáticos. Backoff exponencial puede aterrizar como propuesta `add-match-data-resilience` cuando se mida la necesidad.
- Live-Score-API. Round (b) tras esta.

## Impact

- **Bloquea**: nada.
- **Desbloquea**:
  - `add-leaderboard-sse` puede empezar (poller que llama `provider.getFixtures(...)` y emite eventos).
  - `add-match-data-pipeline` (futura) que persiste los `ProviderMatch` en `matches` con team mapping.
- **Riesgos**:
  - `score.extratime` cumulativo vs incremental fue una sutileza no obvia hasta el smoke test. El parser tiene tests específicos para que un cambio futuro de la API no rompa silenciosamente.
  - Plan free 100 req/día. La integration test consume 1 por ejecución; si se ejecuta agresivamente en CI con la key real, agotaría el cupo. Por eso `skipIf(!API_FOOTBALL_KEY)` y la convención de no exponer la key en CI hasta que estemos cerca del lanzamiento.
- **Compromisos cerrados**: el provider devuelve `ProviderMatch.homeTeam.code = null` para api-football (no entrega códigos FIFA en su shape). El team-mapping a códigos del seed wc2022 es responsabilidad del pipeline, no del provider.

## Decisiones tomadas

- **Dos capas de transformación**: `raw API JSON → ProviderMatch → MatchOutcome`. Razón: aislar lógica de provider concreto (parser) de lógica de dominio (adapter). Un futuro `LiveScoreApiProvider` reusa el adapter sin cambios.
- **Errores tipados con `code` enum**: el caller puede reaccionar (ej. `plan_limited` → activar fallback secundario; `rate_limited` → retry con backoff).
- **`fetcher` inyectable**: tests sin red sin necesidad de `vi.mock("node:fetch")` ni MSW.
- **`describe.skipIf` en integration**: tests reales corren localmente con la key, y se saltan en CI sin la key. No requiere setup adicional ni dotenv.
- **Stage como `MatchStage | null` en `ProviderMatch`**: si el provider entrega un round que no sabemos clasificar (`"Friendly"`, `"Pre-season"`), el partido sigue siendo válido como snapshot pero no es scoreable. El adapter throwea cuando intenta usarlo.
- **`status: "abandoned"` colapsa a `MatchStatus: "cancelled"`** en el adapter: para el scoring engine, abandoned = cancelled (predicción anulada, racha "salta"). Esto puede revisarse cuando aterricen reglas específicas para partidos abandonados (no las hay hoy en `business-rules.md`).
