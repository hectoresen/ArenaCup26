# Data pipeline — cómo se alimenta ArenaCup26

De dónde sale cada dato que aparece en la UI. Toda la entrada está
en este doc; si un valor en pantalla no encaja, su origen está aquí.

## Fuentes de datos

| Fuente                | Tipo de dato                                | Frecuencia            |
|-----------------------|---------------------------------------------|-----------------------|
| **api-football** (Pro) | Partidos, equipos, marcadores, eventos      | Polling REST cada 2-180 min |
| **Auth.js + Google**  | Identidad del usuario (email, nombre, foto) | Al iniciar sesión     |
| **Input directo**     | Predicciones, perfil, amistades, invites    | Al uso                |
| **Bootstrap seed**    | Logros del catálogo + 7 placeholders        | Una vez por deploy    |

## Crons programados (GitHub Actions)

Todos disparan endpoints de la app vía HTTPS con `Authorization: Bearer
$CRON_SECRET`. Si necesitas mover uno a otro scheduler externo
(Vercel cron, una VM con crontab, EasyCron), basta con replicar el
`curl` del paso `run:` del workflow correspondiente.

| Workflow                                         | Cadencia       | Endpoint                          | Aporta                                  |
|--------------------------------------------------|----------------|-----------------------------------|------------------------------------------|
| [`match-data-sync.yml`](../.github/workflows/match-data-sync.yml) | cada 3 h   | `/api/cron/sync-fixtures`         | Calendario de partidos en BD            |
| [`live-scoring.yml`](../.github/workflows/live-scoring.yml)       | cada 2 min | `/api/cron/live-scoring`          | Marcadores en vivo + trigger de scoring |
| [`snapshot-ranking.yml`](../.github/workflows/snapshot-ranking.yml) | 00:05 UTC | `/api/cron/snapshot-ranking`      | Histórico del ranking (delta + sparkline)|
| [`db-backup.yml`](../.github/workflows/db-backup.yml)             | 03:00 UTC  | (script `pg_dump` a S3)           | Backup integral de la BD                |

### match-data-sync — _calendario amplio_

Cada 3 h pide a api-football los partidos de las 7 ligas configuradas
(`MATCH_DATA_LEAGUE_FILTER`) en una ventana de hoy-1d a hoy+7d. Upserta
en la tabla `matches`, descubre equipos nuevos al vuelo, y si algún
partido cambió a `finished` entre llamadas, dispara `processFinishedMatch`
de respaldo. **Sin este cron, `/partidos` se queda vacío** — es el que
puebla el calendario para que el user tenga qué predecir.

### live-scoring — _marcador en vivo_

Cada 2 min comprueba en BD si hay algún match `live` o un kickoff a
±15/30 min. Si NO, devuelve 204 sin tocar el provider (skip silencioso,
0 cost). Si SÍ, fetch a api-football limitado a los fixtures de hoy y
actualiza marcadores en BD. **Cuando detecta que un partido pasó a
`finished`, ejecuta `processFinishedMatch` in-band**: calcula puntos
para cada predicción, persiste en `user_points`, y los SSE clients
reciben el ranking actualizado en el siguiente tick (≤15 s).

### snapshot-ranking — _histórico del ranking_

Una vez al día (00:05 UTC, justo después de medianoche) vuelca en la
tabla `ranking_snapshots` el rank + puntos de cada user. **Alimenta el
delta semanal** (▲/▼) y la sparkline de la card "Tu posición" en
`/inicio`. Sin esto, el dashboard no puede mostrar evolución temporal.

### db-backup — _seguridad operativa_

Cada noche a las 03:00 UTC ejecuta `pg_dump` del Postgres de Railway y
sube el `.sql.gz` a un bucket S3-compatible (Backblaze B2). El bucket
tiene lifecycle policy a 30 días. **Sin esto, un incidente en Railway
significaría pérdida total de predicciones y puntos** — es la red de
seguridad del producto.

## Bootstrap (no-cron)

`scripts/bootstrap.ts` se ejecuta en cada deploy. Idempotente:

- **`seedAchievements`** → inserta/actualiza el catálogo de 24 logros
  en `achievement_definitions`.
- **`seedLeaderboardPlaceholders`** → mete los 7 placeholders (Maya
  Petrova, Kenji Yamamoto, etc.) con puntos, racha, `lastActiveAt` y
  algunos logros desbloqueados, para que el ranking no luzca vacío
  en los primeros minutos de vida del proyecto.

Cuando haya tráfico orgánico que supere los placeholders, se puede
retirar invocando `removeLeaderboardPlaceholders`.

## Flujo end-to-end de un gol → ranking actualizado

```
[gol real]
   │
   ▼ ~5-15s
[api-football lo publica]
   │
   ▼ 0-2 min (espera al próximo tick de live-scoring)
[live-scoring cron pide /fixtures?date=hoy]
   │
   ├─ actualiza matches.homeScore/awayScore en BD
   │
   ▼ (si el match pasa a finished)
[processFinishedMatch in-band]
   │
   ├─ recorre predicciones de ese match
   ├─ calcula puntos con scoreMatchPrediction
   └─ UPDATE user_points (totalPoints, streak, correctCount)
   │
   ▼ ≤15s
[SSE /api/leaderboard/stream emite siguiente snapshot]
   │
   ▼ ≤30s en dashboard (LiveAutoRefresh)
[UI muestra puntos provisionales / ranking nuevo]
```

Latencia worst-case extremo a extremo: ~**3 min** (gol → user lo ve en
el ranking). Aceptable para un juego de predicciones; no es un live
broadcasting. Para bajarlo a sub-segundo haría falta Redis pub/sub +
api-football webhooks (este último no existe — habría que cambiar a
Sportmonks con Pusher).

## Configuración relevante (env vars)

Documentadas en detalle en [`api-football-config.md`](api-football-config.md).
Resumen:

| Variable                     | Default        | Cron afectado                |
|------------------------------|----------------|------------------------------|
| `MATCH_DATA_MODE`            | `date-window`  | match-data-sync, live-scoring|
| `MATCH_DATA_LEAGUE_FILTER`   | `[]`           | match-data-sync, live-scoring|
| `MATCH_DATA_BEFORE_DAYS`     | `1`            | match-data-sync              |
| `MATCH_DATA_AFTER_DAYS`      | `1`            | match-data-sync              |
| `MATCH_DATA_LEAGUE_ID`       | `1`            | si `MODE=season` (Mundial)   |
| `MATCH_DATA_SEASON`          | `2026`         | si `MODE=season` (Mundial)   |
| `API_FOOTBALL_KEY`           | (set)          | ambos                        |
| `CRON_SECRET`                | (set)          | autenticación de los 4 crons |

## Qué hacer si algo se rompe

- **`/partidos` vacío** → mira el último run de `match-data-sync` en
  GitHub Actions. Si falla, revisa logs del endpoint en Railway.
- **Marcador atrasado en un partido en vivo** → `live-scoring` no
  está disparando o falla. Mismo path de debug.
- **Puntos no se actualizan al terminar un match** → buscar
  `processFinishedMatch result` en logs de Railway. Si no aparece,
  el match no transicionó a `finished` en BD; revisar el upstream.
- **Ranking estancado** → `snapshot-ranking` falló esta noche, el
  delta semanal seguirá funcionando pero el sparkline no avanzará.
