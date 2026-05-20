# API-Football — configuración y switch al Mundial 2026

Doc operacional. Para investigación histórica de proveedores ver
`docs/match-data-research.md`.

## Plan activo

- **Pro $19/mes** (2026-05-17 →). 7 500 req/día. Todas las APIs disponibles.
- Refresco oficial del provider: **15 s** sobre `fixtures/live` y `fixtures/events`.
- Sin WebSocket / push — REST puro. El polling lo hace nuestro cron.
- Header de auth: `x-apisports-key`. Base: `https://v3.football.api-sports.io`.

## Endpoints relevantes

| Endpoint                                  | Uso                                                          |
|-------------------------------------------|--------------------------------------------------------------|
| `GET /leagues?id=<ID>`                    | Metadata de una liga + seasons soportadas.                   |
| `GET /fixtures?date=YYYY-MM-DD`           | Fixture por día (modo `date-window`, actual).                |
| `GET /fixtures?league=<ID>&season=<YYYY>` | Fixture por liga + temporada (modo `season`, futuro Mundial).|
| `GET /fixtures?live=all`                  | Partidos en curso ahora mismo.                               |
| `GET /fixtures/events?fixture=<id>`       | Goles, tarjetas, sustituciones de un partido.                |
| `GET /fixtures/statistics?fixture=<id>`   | Posesión, tiros, faltas — para enriquecer detalle.           |
| `GET /fixtures/lineups?fixture=<id>`      | Alineaciones titulares + suplentes.                          |

## IDs de liga relevantes

| ID  | Liga                          | Notas                                  |
|----:|-------------------------------|----------------------------------------|
| **1** | **FIFA World Cup**          | **El Mundial. Switch target.**         |
|   2 | UEFA Champions League         |                                        |
|  39 | Premier League (Inglaterra)   |                                        |
|  61 | Ligue 1 (Francia)             |                                        |
|  78 | Bundesliga (Alemania)         |                                        |
| 135 | Serie A (Italia)              |                                        |
| 140 | La Liga (España)              |                                        |
| 253 | MLS (USA)                     |                                        |
|   4 | Euro Championship             | Cuando aplique.                        |
|   9 | Copa América                  | Cuando aplique.                        |

## Configuración actual (2026-05-17, fase QA)

Modo `date-window` filtrado a top ligas europeas + UCL + MLS, ventana
de 7 días hacia adelante:

```
MATCH_DATA_MODE=date-window                # (default, no set en Railway)
MATCH_DATA_LEAGUE_FILTER=140,39,135,78,61,2,253
MATCH_DATA_BEFORE_DAYS=1                   # (default, no set)
MATCH_DATA_AFTER_DAYS=7
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_KEY=<set en Railway>
```

Estimación de quota: 7-9 días × 1 req/día = ~10 req/día por sync de
fixtures, + ticks del self-cron in-process (cada 2 min cuando hay
match activo). Pico durante un día con 4 partidos en paralelo:
~1 440 req/día. Cabe sobrado en los 7 500 del plan Pro.

## Switch al Mundial 2026 (junio 2026)

Cuando arranque el torneo, **solo se tocan env vars** (no hay código que
modificar). Cambio en Railway:

```
MATCH_DATA_MODE=season
MATCH_DATA_LEAGUE_ID=1
MATCH_DATA_SEASON=2026
MATCH_DATA_LEAGUE_FILTER=                  # vaciar — el modo season ignora este filtro
```

El cron pasará de pedir `?date=YYYY-MM-DD` a pedir
`?league=1&season=2026`, devolviendo el fixture completo del Mundial
(104 partidos en formato 48 equipos). Después de aplicar:

1. Verificar en `/status` que el `data-provider` health pinta OK.
2. Invocar manualmente `/api/cron/sync-fixtures` con `Bearer
   $CRON_SECRET` para forzar el primer fetch sin esperar al cron.
3. Comprobar en `/partidos` que aparecen los 104 partidos.

## Variables (`src/lib/env.ts`)

| Variable                   | Default        | Uso                                                                 |
|----------------------------|----------------|---------------------------------------------------------------------|
| `MATCH_DATA_MODE`          | `date-window`  | `date-window` (filtro local) o `season` (filtro server-side).       |
| `MATCH_DATA_BEFORE_DAYS`   | `1`            | Días hacia atrás en modo date-window.                               |
| `MATCH_DATA_AFTER_DAYS`    | `1`            | Días hacia adelante en modo date-window.                            |
| `MATCH_DATA_LEAGUE_FILTER` | `[]` (todas)   | CSV de league IDs. Solo aplica en modo date-window.                 |
| `MATCH_DATA_LEAGUE_ID`     | `1`            | Solo aplica en modo season. **`1` = WC**.                           |
| `MATCH_DATA_SEASON`        | `2026`         | Solo aplica en modo season.                                         |

## Crons que consumen el provider

- **`/api/cron/sync-fixtures`** — cada **3 h** vía GitHub Actions.
  Refresca fixtures de la ventana configurada. Requiere header
  `Authorization: Bearer $CRON_SECRET`.
- **Self-cron in-process** (`src/server/cron/in-process-scheduler.ts`)
  — cada **2 min** dentro del proceso Node del wmundial. Solo dispara
  si hay match `live` o kickoff en ±15 min. Cuando detecta un match
  pasando a `finished`, llama `processFinishedMatch` in-band → actualiza
  `user_points`. NO usa HTTP ni CRON_SECRET — invoca la lógica
  directamente. Ver `docs/data-pipeline.md §self-scheduler` para
  rationale.

## Campos de api-football que recibimos pero NO usamos (futuro)

Cada llamada a `/fixtures` ya nos devuelve más datos de los que
persistimos. Aprovecharlos no añade requests — solo más SELECT/UPDATE
sobre columnas existentes o nuevas. Lista priorizada:

| Campo del provider              | Coste de añadir | Valor UX                                        |
|---------------------------------|-----------------|-------------------------------------------------|
| `fixture.status.elapsed`        | ✅ Implementado 2026-05-20 (columna `minute`) | "Min 67'" en las cards live. |
| `fixture.status.extra`          | columna `addedTime` int + parser | Tiempo añadido cuando el árbitro lo señala.    |
| `fixture.status.long`           | distinguir `Halftime`, `Penalty Shootout`, etc. sin BD | Diferenciar "Descanso" vs "1ª parte".          |
| `score.halftime.{home,away}`    | 2 columnas nuevas | Marcador al descanso en el detalle del partido. |
| `fixture.venue.name + city`     | columnas `venueName`, `venueCity` | "Estadio Azteca · Ciudad de México" en detalle. |
| `fixture.referee`               | columna `refereeName` | Curiosidad bonita en el detalle.                |
| `league.logo`, `league.flag`    | URLs (CDN api-football) | Logo de la liga / bandera del país en cards.    |
| `teams.{home,away}.winner`      | post-finished, derivable de score → no añade valor real. | — |

Si añades alguno, recuerda regenerar la migración con
`npx drizzle-kit generate` y propagar a `MatchListItem` /
`MatchDetail`. El parser de api-football vive en
`src/server/match-data/providers/api-football.parser.ts`.
