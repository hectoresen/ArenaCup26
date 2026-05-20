# Data pipeline — cómo se alimenta ArenaCup26

De dónde sale cada dato que aparece en la UI. Toda la entrada está
en este doc; si un valor en pantalla no encaja, su origen está aquí.

## ⏱ Tabla maestra de cadencias

Una sola pasada para ver "cada cuánto pasa qué" en el sistema.
Detalle ampliado en las secciones de abajo y en los docs enlazados.

### Polling / refresh del cliente (browser)

| Superficie / componente               | Cadencia | Cuándo aplica                                       | Código                                                       |
|---------------------------------------|----------|-----------------------------------------------------|--------------------------------------------------------------|
| SSE `/api/leaderboard/stream`         | 60 s     | `/inicio` (mini-leaderboard) y `/ranking` (global)  | `FALLBACK_TICK_MS` en `src/app/api/leaderboard/stream/route.ts` |
| SSE heartbeat `:hb`                   | 30 s     | mantener viva la conexión vía proxies               | `HEARTBEAT_MS` ibíd.                                          |
| SSE `event: bye` + reconexión cliente | 30 min   | reciclar el TCP / liberar memoria server            | `MAX_DURATION_MS` ibíd.                                       |
| `<LiveAutoRefresh>` en /inicio        | 30 s     | mientras hay un partido `status='live'`             | `src/components/dashboard/live-auto-refresh.tsx`              |
| `<PreKickoffAutoRefresh>`             | 60 s     | ±30 min alrededor del kickoff del próximo partido   | ibíd.                                                         |

### Crons servidor (GitHub Actions → Railway)

| Workflow                                | Cadencia          | Objetivo                                                       |
|-----------------------------------------|-------------------|----------------------------------------------------------------|
| `match-data-sync.yml`                   | cada 3 h          | Sincronizar fixtures de las ligas configuradas (hoy-1d → +7d)  |
| `live-scoring.yml`                      | cada 2 min¹       | Marcadores en vivo + kickoff reminders + trigger scoring       |
| `snapshot-ranking.yml`                  | 00:05 UTC diario  | Snapshot histórico del ranking (delta 24h + sparkline 7d)      |
| `auto-reject-bot-requests.yml`          | 03:30 UTC diario  | Auto-rechazar friend/group requests a bots >48h pending + refresh `lastActiveAt` de los 5 bots "live" |
| `db-backup.yml`                         | 03:00 UTC diario  | Backup íntegro Postgres → Backblaze B2 (retención 30d)         |
| `db-backup-tournament.yml`              | cada 6 h          | Backup elevado durante el Mundial (date guard 11 jun→19 jul 2026) |

¹ GitHub Actions free tier honra `*/2 * * * *` con intervalos reales
de **30-60 min** en momentos de alta carga global (documentado por
GitHub). El cron HTTP queda como safety net pero la cadencia real de
live-scoring viene del **self-scheduler in-process** descrito abajo.

### Self-scheduler in-process (Node)

Desde 2026-05-20, el wmundial arranca al subir el proceso un
`setInterval` que ejecuta cada **2 min reales** la misma lógica que
el cron HTTP `/api/cron/live-scoring`:

- Implementación: `src/server/cron/in-process-scheduler.ts`,
  enganchado en `src/instrumentation.ts`.
- Llama directo a `shouldSyncLive` + `syncFixtures` +
  `triggerKickoffReminders` — **sin HTTP, sin bearer, sin red
  externa**. Cadencia garantizada por el event loop de Node.
- Tick inmediato al arranque (catch-up tras deploy).
- Idempotente: el `started` flag evita doble registro tras
  hot-reload o múltiples `register()`.
- Limita por `NODE_ENV=production` y por presencia de
  `API_FOOTBALL_KEY` para no ensuciar dev/CI.
- **Limitación**: si Railway escala a múltiples instancias del
  servicio, cada réplica ejecuta su propio tick. Asumido —
  el setup actual es single-instance y los upserts son idempotentes.

### Provider externo

| Aspecto                                  | Cadencia / valor       |
|------------------------------------------|------------------------|
| api-football refresh oficial (live)      | 15 s                   |
| Quota plan Pro                           | 7 500 req/día          |
| Uso estimado actual (steady state)       | ≤ 800 req/día          |

### Rate-limits (in-memory por proceso Node)

| Scope        | Límite           | Identificador | Aplicado en                          |
|--------------|------------------|---------------|--------------------------------------|
| `submit`     | 10 / 60 s        | userId        | Predicciones (`submitPredictionAction`) |
| `cron`       | 6 / 60 s         | IP            | Endpoints `/api/cron/*` (segunda capa tras bearer) |
| `publicRead` | 60 / 60 s        | IP            | `/` (landing pública) y `/u/<username>` |
| `signup`     | 5 / 3600 s       | IP            | Callback `signIn` de Auth.js          |

### Cooldowns de usuario

| Acción                       | Cooldown | Doc                                    |
|------------------------------|----------|----------------------------------------|
| Cambio de nombre público     | 1 h      | `src/server/profile/actions.ts` (`NAME_COOLDOWN_MS`) |
| Cambio de avatar             | 1 h      | mismo cooldown que nombre              |

### Otras ventanas relevantes

| Ventana                                          | Valor       | Para qué                                                            |
|--------------------------------------------------|-------------|---------------------------------------------------------------------|
| Online dot — umbral de actividad reciente        | 24 h        | "Puntito verde" en RankRow/PodiumCard/mini-leaderboard               |
| `lastActiveAt` ping throttle (app layout)        | 5 min       | UPDATE a `users.lastActiveAt` máximo cada 5 min por user            |
| Window predicción abierta                        | hasta kickoff | Tras el kickoff `predictionLocked`; ver `docs/scoring.md`        |
| Auto-reject de friend/group requests a bots      | 48 h        | El cron `auto-reject-bot-requests` los marca `rejected` tras este umbral |
| Snapshot history TTL relevante                   | 7 días      | Ventana de la sparkline + cálculo del rankDelta histórico           |

---

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
| [`live-scoring.yml`](../.github/workflows/live-scoring.yml)       | cada 2 min | `/api/cron/live-scoring`          | Marcadores en vivo + kickoff reminders + trigger de scoring |
| [`snapshot-ranking.yml`](../.github/workflows/snapshot-ranking.yml) | 00:05 UTC | `/api/cron/snapshot-ranking`      | Histórico del ranking (delta 24h + sparkline 7d)|
| [`auto-reject-bot-requests.yml`](../.github/workflows/auto-reject-bot-requests.yml) | 03:30 UTC | `/api/cron/auto-reject-bot-requests` | Limpia friend requests + group invitations a bots con >48h pending |
| [`db-backup.yml`](../.github/workflows/db-backup.yml)             | 03:00 UTC  | (script `pg_dump` a S3, prefijo `daily/`) | Backup integral diario, retención 30d |
| [`db-backup-tournament.yml`](../.github/workflows/db-backup-tournament.yml) | cada 6h (solo Mundial) | (script `pg_dump` a S3, prefijo `tournament/`) | Backup elevado durante el torneo (date guard 11 jun → 19 jul 2026) |

### Secrets compartidos por los workflows

| Secret en GitHub              | Valor                                                          |
|-------------------------------|-----------------------------------------------------------------|
| `CRON_SECRET`                 | Token shared con Railway (`Authorization: Bearer …`)            |
| `RAILWAY_SYNC_URL`            | `https://www.arenacup26.com/api/cron/sync-fixtures`             |
| `RAILWAY_LIVE_URL`            | `https://www.arenacup26.com/api/cron/live-scoring`              |
| `RAILWAY_SNAPSHOT_URL`        | `https://www.arenacup26.com/api/cron/snapshot-ranking`          |
| `RAILWAY_AUTO_REJECT_URL`     | `https://www.arenacup26.com/api/cron/auto-reject-bot-requests`  |
| `DATABASE_URL` (solo backups) | Connection string de Postgres (vía `railway variables`)         |
| `BACKUP_S3_*` (solo backups)  | Acceso a Backblaze B2 (ACCESS_KEY, SECRET_KEY, BUCKET, REGION)  |

### match-data-sync — _calendario amplio_

Cada 3 h pide a api-football los partidos de las 7 ligas configuradas
(`MATCH_DATA_LEAGUE_FILTER`) en una ventana de hoy-1d a hoy+7d. Upserta
en la tabla `matches`, descubre equipos nuevos al vuelo, y si algún
partido cambió a `finished` entre llamadas, dispara `processFinishedMatch`
de respaldo. **Sin este cron, `/partidos` se queda vacío** — es el que
puebla el calendario para que el user tenga qué predecir.

### live-scoring — _marcador en vivo_

Cada 2 min comprueba en BD si hay algún match `live` o un kickoff a
±15/30 min. Si NO, devuelve 200 con `synced:false` sin tocar el provider
(skip silencioso, 0 cost). Si SÍ, fetch a api-football limitado a los
fixtures de hoy y actualiza marcadores en BD. **Cuando detecta que un
partido pasó a `finished`, ejecuta `processFinishedMatch` in-band**:
calcula puntos para cada predicción, persiste en `user_points`, y los
SSE clients reciben el ranking actualizado en el siguiente tick (≤15 s).

**Kickoff reminders**: en cada tick (independiente de si hay sync o no),
busca partidos con kickoff en [+25, +35] min y dispara push
`prediction_locked` a usuarios activos (lastActive < 30d) que no hayan
predicho. Dedup natural por `notifications.matchId + kind` evita
duplicados.

### snapshot-ranking — _histórico del ranking_

Una vez al día (00:05 UTC, justo después de medianoche) vuelca en la
tabla `ranking_snapshots` el rank + puntos de cada user. **Alimenta el
delta de 24h** (▲/▼ vs snapshot del día anterior) y la sparkline de la
card "Tu posición" en `/inicio`.

**Por qué 24h y no semanal**: el Mundial dura ~5 semanas. Con delta
semanal el usuario ve evolución 2-3 veces total — muy poco feedback. Con
delta de 24h ve el contexto cada día. La sparkline cubre 7 días para
seguir dando contexto de tendencia.

Sin esto, el dashboard no puede mostrar evolución temporal.

### auto-reject-bot-requests — _housekeeping de bots_

Una vez al día (03:30 UTC) llama al endpoint que marca como `rejected`
las friend requests y group invitations dirigidas a bots con > 48h en
`pending`. Los 27 bots no son usuarios reales, así que no aceptan ni
rechazan — sin este cron las solicitudes quedarían pending para siempre,
ocupando la bandeja "enviadas" del user real que invitó.

Idempotente: si no hay nada pending >48h, responde
`{friendshipsRejected: 0, groupInvitationsRejected: 0}` y termina sin
side-effects.

### db-backup — _seguridad operativa (daily)_

Cada noche a las 03:00 UTC ejecuta `pg_dump` del Postgres de Railway y
sube el `.sql.gz` a un bucket S3-compatible (Backblaze B2) bajo el
prefijo `daily/`. Lifecycle policy 30 días. **Sin esto, un incidente
en Railway significaría pérdida total de predicciones y puntos** — es
la red de seguridad base.

### db-backup-tournament — _granularidad fina durante el Mundial_

Cada 6 h durante la ventana del Mundial (11 jun → 19 jul 2026) sube
backups adicionales con prefijo `tournament/`. Fuera de la ventana,
el primer step del job hace short-circuit y no toca BD ni S3. Lifecycle
policy del bucket: borrar `tournament/*` tras 14 días para que no se
acumulen ~120 backups indefinidamente. Para recovery a momento más
granular durante un partido, este es el path.

### Script auxiliar: `recompute-user-points.ts`

No es un cron — es un script manual idempotente que reconstruye
`user_points` desde `point_events` (la fuente de verdad inmutable).
Útil cuando los dos quedan desincronizados por un incidente o bug.
Dry-run por default; aplicar con `--apply`.

## Bootstrap (no-cron)

`scripts/bootstrap.ts` se ejecuta en cada deploy. Idempotente:

- **`seedAchievements`** → inserta/actualiza el catálogo de 25 logros
  en `achievement_definitions`.
- **`backfillTeamSpirit`** → reconcilia el logro `team-spirit` para
  usuarios con ≥1 membership activa que no lo tienen aún. Idempotente,
  sin notificaciones. Necesario porque el gate global
  (`ACHIEVEMENTS_MIN_FINISHED_MATCHES`) impedía el unlock en flujos de
  group action; ahora el gate tiene `GATE_BYPASS` pero pre-existentes
  necesitan backfill.
- **`seedLeaderboardPlaceholders`** → mete los 7 placeholders (Maya
  Petrova, Kenji Yamamoto, etc.) con puntos, racha, `lastActiveAt` y
  algunos logros desbloqueados, para que el ranking no luzca vacío
  en los primeros minutos de vida del proyecto.

Cuando haya tráfico orgánico que supere los placeholders, se puede
retirar invocando `removeLeaderboardPlaceholders`.

## Ranking event-driven (Upstash + pointer poll)

El SSE del ranking (`/api/leaderboard/stream`) emite un **snapshot
cada 15 s** a todos los clientes conectados, más el snapshot inicial
al conectar. Suficiente para el requisito de "ranking en vivo" sin
infraestructura externa.

- `FALLBACK_TICK_MS = 15_000` en `src/app/api/leaderboard/stream/route.ts`.
- Heartbeat `:hb` cada 30 s para mantener viva la conexión vía proxies
  que cierran idle.
- `event: bye` al alcanzar `MAX_DURATION_MS` (30 min) para que el
  cliente reabra la conexión limpiamente (evita `ERR_CONNECTION_RESET`).

**Historial breve**: entre 2026-05-18 y 2026-05-20 existía un patrón
pointer-poll vía Redis para conseguir latencia <1s. Se retiró cuando
el adapter HTTP de Upstash interno de Railway resultó inestable y se
decidió no migrar a Upstash Cloud — la latencia de 15s cumple
sobradamente y elimina una dependencia externa. Si en el futuro hace
falta sub-segundo, reintroducir Redis es ~30 líneas en el route.

## Rate limiting

Implementación **in-memory** (`src/lib/rate-limit.ts`) con
`Map<scope:id:bucket, {count, resetAt}>` por proceso Node. Mismo
algoritmo fixed-window counter que la versión previa con Upstash,
sin la dependencia de red.

| Scope        | Límite      | Identificador | Aplicado en                    |
|--------------|-------------|---------------|--------------------------------|
| `submit`     | 10 / 60s    | userId        | `submitPredictionAction`       |
| `cron`       | 6 / 60s     | IP            | endpoints `/api/cron/*`        |
| `publicRead` | 60 / 60s    | IP            | `/`, `/u/<username>`           |
| `signup`     | 5 / 3600s   | IP            | `/api/notifications/subscribe` |

**Tradeoffs**:
- Estado por instancia — si escalamos a múltiples réplicas, el límite
  efectivo se multiplica por N. Aceptable a escala actual.
- Estado volátil — un deploy resetea contadores. Un atacante avispado
  podría aprovecharlo pero el ratio coste/beneficio no compensa.
- Si en algún momento fuera necesario un store compartido, mover a
  Postgres (tabla `rate_limit_buckets` con upsert atómico) es ~50
  líneas. No requiere infra externa adicional.

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
[processFinishedMatch in-band, batch concurrency=25]
   │
   ├─ recorre predicciones de ese match
   ├─ calcula puntos con scoreMatchPrediction
   ├─ UPDATE user_points (totalPoints, streak, correctCount)
   └─ publishRankingChange() → Redis SETEX
   │
   ▼ ≤1s (poll de SSE al pointer Redis)
[SSE /api/leaderboard/stream emite snapshot a clientes conectados]
   │
   ▼ ≤30s en dashboard (LiveAutoRefresh)
[UI muestra puntos provisionales / ranking nuevo]
```

Latencia worst-case extremo a extremo:

- **Gol real → BD**: ~5-15 s (provider) + 0-2 min (cron live-scoring)
  = ~**2-3 min** en el peor caso. Cuello de botella: la cadencia del
  cron, no nuestro código.
- **BD → UI**: ≤15 s (tick periódico del SSE).

Para bajar el lag total habría que sustituir el cron polling por
webhooks del provider (api-football no soporta; Sportmonks con Pusher
sí, ~€69/mes). En el lado servidor→cliente también es asumible
volver a un pub/sub Redis si algún día necesitamos sub-segundo, pero
no es requisito actual.

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
