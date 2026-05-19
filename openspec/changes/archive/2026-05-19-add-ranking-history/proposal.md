# add-ranking-history

## Why

Hoy:
- `pointsDelta` siempre `null` en perfil público + dashboard (decisión [12.x] explícita).
- `previousRank` se setea igual a `rank` en `getRealSnapshot` — el indicador ▲/▼ nunca se mueve.
- Sparkline en `/inicio` placeholder.

Sin histórico no hay "ganaste +120 puntos esta semana" ni "subiste 5 posiciones desde el viernes". Mata gran parte del componente competitivo.

## What changes

Capability nueva: **`ranking-history`**.

### Schema

`ranking_snapshots` table:
- `id uuid pk`.
- `user_id uuid fk users.id cascade`.
- `points int not null`.
- `rank int not null`.
- `captured_at timestamp not null default now()`.
- Índice (`user_id`, `captured_at desc`).

### Job de snapshot

- Cron diario (3am UTC) inserta un row por cada user con points. ~30 rows/día con 30 users = barato.
- Reusa GitHub Actions cron (nuevo workflow) o se acopla al sync-fixtures con un flag de "es la primera ejecución del día".

### Queries

- `getPointsDelta(userId, days = 7)`: diff entre points actual y points del snapshot más cercano a `now - days`.
- `getRankDelta(userId, days = 7)`: idem para rank.
- `getSparkline(userId, days = 7)`: array de `{captured_at, points}` para el sparkline.

### Wiring

- `getDashboardData` consume `getPointsDelta` y `getRankDelta`; sparkline va al componente `RankProgressCard`.
- `getPublicProfile` consume `getPointsDelta`.
- `getRealSnapshot` consume rank de hace 24h (o 7d configurable) → setea `previousRank` correctamente; el indicador ▲/▼ pasa a tener sentido.

## Impact

- **Coste BD**: 30 users × 365 días = 11k rows/año. Trivial.
- **Retención**: snapshots > 90 días se borran (otra crontab) — no necesitamos histórico ilimitado.
- **Bloquea**: nada.
- **Desbloquea**: indicadores ▲/▼ reales, delta semanal en perfil, sparkline.
