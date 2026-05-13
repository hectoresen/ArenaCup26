# add-home-dashboard

## Why

Hoy la única página del área privada es la auth + algún placeholder. El mockup `docs/iniciopaneldeusuario.txt` define el "panel de inicio" que ve un usuario logado al abrir la app: saludo, mini-stats, partido en vivo con su predicción, próximos partidos, progreso (logros + posición), mini-leaderboard. Sin esto el usuario aterriza en una pantalla vacía tras login y no tiene un punto de entrada.

Esta propuesta materializa el panel sobre la ruta `/inicio` ya autenticada por `add-app-shell`. Es la primera página del área logada con contenido real conectado a la BD (resto de las páginas — `/partidos`, `/ranking`, `/logros` — vienen después con sus propias propuestas).

## What changes

Capability nueva: **`home-dashboard`**.

### Ruta y data fetching

`src/app/[locale]/(app)/inicio/page.tsx`:

- Server component. Llama `auth()` (el layout `(app)` ya garantiza sesión).
- Pide al server `getDashboardData(userId)` que devuelve todas las secciones en una sola consulta paralela: stats del user, live match (si hay), próximos partidos (5), progreso (logros + ranking), top 5 + me.
- Pasa cada bloque a su componente correspondiente.

`src/server/dashboard/queries.ts`:

- `getDashboardData(userId)`: `Promise.all` de las queries individuales.
- `getUserStats(userId)`: lee `userPoints` y devuelve `{ totalPoints, streak, correctCount, achievementsUnlocked, achievementsTotal, rank, totalPlayers }`.
- `getLiveMatch(userId)`: el primer match con `status = "live"`, con la predicción del user para ese match si existe. Devuelve `null` si no hay live.
- `getNextMatch(userId)`: el siguiente kickoff con `status = "scheduled"` o `"prediction-locked"` (para el fallback "Próximo partido" cuando no hay live).
- `getUpcomingMatches(userId, limit = 5)`: cards de partidos `kickoffAt > now()` con la predicción del user si existe, marcados como TBD si `homeTeamId` o `awayTeamId` son null.
- `getProgress(userId)`: `{ achievementsUnlocked, achievementsTotal, rank, rankDelta, sparkline }`. `rankDelta` y `sparkline` van con placeholder hasta que aterrice `add-ranking-history`.
- `getMiniLeaderboard(userId)`: reusa `getLeaderboard()` de `add-leaderboard-public` pidiendo `top: 5, includeMe: true`.

### Componentes

`src/components/dashboard/`:

- **`Hero`** — saludo, ranking #N de T, 3 mini-stats.
- **`LiveSection`** — header rojo con dot pulsante + `<LiveCard>`. Si no hay live, renombra el header a "Próximo partido" y renderiza `<UpcomingHeroCard>` con countdown.
- **`LiveCard`** — marcador grande + minuto + bloque de tu predicción + badge "Provisional". Si el round (a) del provider no expone goles parciales, el bloque de puntos muestra `Se calcula al final del partido` en lugar de `+30 pts`.
- **`UpcomingHeroCard`** — fallback cuando no hay live: equipos, fecha relativa, countdown.
- **`MatchCard`** — card de la lista de próximos. 3 variantes por prop: `predicted` (badge verde "Enviada"), `pending` (CTA "Predecir"), `tbd` (gris, no clickable).
- **`ProgressCards`** — grid de 2: `AchievementsProgressCard` (8/24 + barra animada `growBar`) y `RankProgressCard` (#N + sparkline si hay datos o placeholder "Empezamos a registrar el 11 de junio").
- **`MiniLeaderboard`** — top 5 + separador + tu fila destacada en clase `me`.
- **`Floaters`** — componente client decorativo con 7 emojis ⚽ floatantes. Opt-in vía `prefers-reduced-motion` (no se monta si reduced).

### i18n

Mensajes en `dashboard.*` para los cuatro locales. Las fechas relativas (`Hoy`, `Mañana`, `09 jul`) usan un helper en `src/lib/format/date.ts` (`formatMatchDate(d, locale, today)`) que devuelve `Hoy/Mañana` para los 2 días siguientes y el formato corto del locale para el resto. Pure function, testeable.

### Manejo de "datos que aún no existen"

Por la decisión "implementar lo que se pueda; placeholder visible para el resto":

- **Live card sin goles parciales**: el bloque `+30 pts` se sustituye por un literal `Se calcula al final del partido` con tooltip. Cuando `add-leaderboard-sse` o `add-live-scoring` exponga los goles parciales, lo conectamos.
- **Sparkline + delta `▲ +3`**: visible con placeholder textual `Empezamos a registrar el 11 de junio`. La sparkline se sustituye por un mensaje neutro hasta tener histórico (capability futura `add-ranking-history`).
- **`12 480 jugadores`**: real, `select count(*) from users`.

### Tests

- **Queries** (`queries.test.ts` con db en memoria a base de mocks Drizzle): cada query individual con datos de fixture; el caller no panicquea cuando no hay live; el caller ordena correctamente próximos por kickoffAt.
- **Components**:
  - `Hero`: render con stats; locale aplica formato es-ES al ranking.
  - `LiveSection`: con live → "En vivo ahora"; sin live + con próximo → "Próximo partido" + countdown.
  - `LiveCard`: muestra `Se calcula al final del partido` cuando no hay puntos provisionales.
  - `MatchCard`: las 3 variantes renderizan el estado correcto (badge / botón / disabled).
  - `ProgressCards`: barra anima al porcentaje correcto; placeholder visible cuando no hay historia.
  - `MiniLeaderboard`: top 5 + me con la clase `me` y el tag `(tú)`.
- **e2e mínimo**: login mock + navegar a `/inicio` + assertions de bloques principales en el DOM.

**No incluye**:

- Flujo de submit/edit de predicción. Eso lo trae `add-prediction-flow`. El CTA "Predecir" enlaza al detalle del partido (futuro).
- Detalle de partido. El click en una `MatchCard` enlaza a `/partidos/[id]` que aún no existe; por ahora `href` correcto pero página 404.
- Live updates SSE — la página renderiza el snapshot del momento. El refresh real viene con `add-leaderboard-sse`.
- Bell de notificaciones funcional — eso vive en el shell (`add-app-shell`) y se conecta en `add-notifications`.

## Impact

- **Bloquea**: nada inmediato. El usuario logado ya tiene un destino con contenido real.
- **Desbloquea**:
  - `add-prediction-flow` (el CTA "Predecir" abre el flujo).
  - `add-matches-page` (la tab "Partidos" lleva a la lista completa).
  - `add-ranking-history` (sparkline + delta dejan de ser placeholder).
  - `add-leaderboard-sse` (la página deja de ser snapshot y empieza a refrescar).
- **Riesgos**:
  - Performance: 5 queries en paralelo en SSR. Mitigación: índices ya en su sitio (`matches_status_idx`, `matches_kickoff_idx`), límite 5 en próximos y 5 en leaderboard.
  - Sin partidos reales en BD durante el desarrollo, la página muestra muchos placeholders. Mitigación: el seed `wc2022` ya da 24 partidos para QA local.
- **Compromisos cerrados**:
  - Reusamos el dataset del `add-leaderboard-public`. No creamos un módulo de leaderboard nuevo.
  - Las decoraciones (floaters de balones) se omiten si el usuario tiene `prefers-reduced-motion`.
  - Las fechas relativas viven en un helper puro (`formatMatchDate`) para no depender de ICU del runtime — coherente con `formatPointsEs` introducido en el fix de tests.
