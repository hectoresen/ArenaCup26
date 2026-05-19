# Dosier de decisiones técnicas — ArenaCup26

Documento vivo. Cada vez que una capability nueva cierra una decisión técnica no obvia se añade aquí. El objetivo es que cualquier persona (o agente) entrando frío pueda entender por qué algo está como está sin leerse la historia de los commits.

**Convenciones de este dosier**

- Cada entrada tiene **Contexto**, **Decisión**, **Razón** y **Fecha** (cuando aporta).
- Lo que se reabre (porque las condiciones cambiaron) se marca en el contexto con `Revisar:` y un disparador concreto.
- Las decisiones cerradas en specs/proposals OpenSpec **no** se duplican aquí — solo las que tienen ramificaciones cross-capability.

## Índice

1. [Stack y convenciones de proyecto](#1-stack-y-convenciones-de-proyecto)
2. [Modelo de datos](#2-modelo-de-datos)
3. [Scoring engine](#3-scoring-engine)
4. [Internacionalización (i18n)](#4-internacionalización-i18n)
5. [Auth](#5-auth)
6. [Match-data — providers + adapter](#6-match-data--providers--adapter)
7. [Match-data — pipeline (cron + reconciler)](#7-match-data--pipeline-cron--reconciler)
8. [App shell (área logada)](#8-app-shell-área-logada)
9. [Home dashboard `/inicio`](#9-home-dashboard-inicio)
10. [Formato de números y fechas](#10-formato-de-números-y-fechas)
11. [Tests y CI](#11-tests-y-ci)
12. [Despliegue](#12-despliegue)
13. [Roadmap diferido (no decidido todavía)](#13-roadmap-diferido-no-decidido-todavía)

---

## 1. Stack y convenciones de proyecto

### 1.1 Next.js 15 full-stack, server-first

- **Contexto**: necesitamos SSR, SSE más adelante (`add-leaderboard-sse`) y un solo despliegue.
- **Decisión**: Next.js 15 App Router + React 19. Server components por defecto, `"use client"` solo donde haya estado / efectos.
- **Razón**: cero JS extra en páginas estáticas como FAQ; el dashboard puede paralelizar 5 queries sin handshake cliente.

### 1.2 OpenSpec antes del código

- **Decisión**: cada feature no-trivial empieza con `openspec/changes/<name>/{proposal.md, tasks.md, specs/<capability>/spec.md}`. Cuando la implementación cierra, se promueve a `openspec/specs/` y la propuesta se archiva.
- **Razón**: documentar la intención independiente del código permite refactors agresivos sin perder el "por qué". También es la pista para los agentes Claude que retoman el trabajo.

### 1.3 Tailwind 4 con `@theme` + variables CSS

- **Decisión**: tema vive en `src/app/globals.css` dentro de `@theme { --color-* … }`. Nada de `tailwind.config.ts`.
- **Razón**: la forma idiomática de Tailwind 4 evita duplicar el sistema de tokens entre TS y CSS.

### 1.4 Biome para lint + format

- **Decisión**: Biome reemplaza ESLint + Prettier. `npx biome check --fix` aplica todo.
- **Razón**: una sola herramienta, mucho más rápida que la combinación clásica. La regla `lint/nursery/noImgElement` (Next.js) no está activada por defecto en este proyecto; cuando se active habrá que migrar los avatares a `next/image` con dominio configurado.

---

## 2. Modelo de datos

### 2.1 Drizzle ORM contra Postgres real, sin alternativas en memoria

- **Decisión**: drizzle-orm + postgres-js. Tests **no** usan SQLite/pglite — los puros validan lógica de dominio y los integration corren contra Postgres real (docker-compose).
- **Razón**: el schema usa enums Postgres y tipos `uuid` que no se reproducen fielmente en SQLite. Dividir lógica pura ↔ I/O permite cubrir el 95% sin tocar la BD.

### 2.2 Auth.js tablas snake_case en JS

- **Contexto**: el adapter de Drizzle de Auth.js v5 espera nombres JS en snake_case para `refresh_token`, `access_token`, etc.
- **Decisión**: en `src/server/db/schema.ts` la tabla `accounts` usa propiedades JS `refresh_token`, `access_token`, … (no camelCase).
- **Razón**: el adapter las accede por nombre. Convertir rompe sign-in.

### 2.3 `team_external_ids` y `match_external_ids` como tablas intermedias

- **Contexto**: el día 1 hay un solo provider (api-football). El día 2 entra Live-Score-API. Cada uno usa su propio espacio de IDs.
- **Decisión**: tablas intermedias `(team_id, source, external_id)` con PK `(source, external_id)`. **No** se añaden columnas `api_football_id`, `livescore_id`, etc. a `teams`/`matches`.
- **Razón**: el round (b) (failover) no tendrá que migrar el schema; solo añadir filas. Mantiene `teams`/`matches` agnósticos del provider.
- **Fecha**: 2026-05-11.

### 2.4 Match status: enum DB (7) vs ProviderMatchStatus (10)

- **Contexto**: el provider entrega 10 estados (`scheduled`, `live`, `extra_time`, `penalty_shootout`, `finished`, `postponed`, `cancelled`, `abandoned`, `interrupted`, `unknown`). La BD tiene 7 (`scheduled-tbd`, `scheduled`, `prediction-locked`, `live`, `finished`, `postponed`, `cancelled`).
- **Decisión**: en `src/server/match-data/sync/status.ts` se colapsa con tabla fija. `extra_time`/`penalty_shootout`/`interrupted` → `live`; `abandoned` → `cancelled`. `scheduled-tbd` y `prediction-locked` **son estados internos de la app, no producibles desde un provider**.
- **Razón**: el scoring engine reconstruye el detalle live/extra_time/penalty desde los scores (`scoreAt90` + `scoreAtExtra` + `penaltyWinner`). La BD no necesita guardar la fase, solo los scores.

### 2.5 Estado `prediction-locked` controlado por la app

- **Contexto**: cuando el kickoff llega, las predicciones se cierran. El provider sigue diciendo `scheduled` hasta el 1H.
- **Decisión**: el reconciler **nunca** retrocede `prediction-locked` → `scheduled`. Solo lo deja avanzar a `live`/`finished`/etc.
- **Razón**: si retrocediese, un cron tick fuera de orden reabriría las predicciones para un partido que ya empezó. Pérdida de integridad inaceptable.

---

## 3. Scoring engine

### 3.1 Pure function `scoreMatchPrediction(outcome, prediction, streakBefore)`

- **Decisión**: el engine vive en `src/server/scoring/engine.ts` como pure function. Recibe el `MatchOutcome` (no la fila de la BD), la `Prediction` y el `StreakState` previo. Devuelve `ScoreResult`.
- **Razón**: testeable sin DB; reusable desde batch (cron) y stream (SSE). El "qué" es el mismo en ambos paths.

### 3.2 `scoreAtExtra` siempre cumulativo

- **Contexto**: api-football devuelve `score.extratime = {home:1, away:1}` cuando el partido acaba 3-3 (regulación 2-2). Eso es **el goal incremental durante la prórroga, no el cumulativo**.
- **Decisión**: `parseApiFootballFixture` calcula `scoreAtExtra` como `goals = fulltime + extratime` (cumulativo). El campo en `ProviderMatch` siempre representa el marcador al final de la prórroga.
- **Razón**: el scoring exact compara el predicho 3-3 contra el cumulativo, no contra los goles de prórroga aislados. Documentado con tests específicos para que un cambio de shape de la API no lo rompa silenciosamente.
- **Fecha**: 2026-05-10 (descubierto en smoke test).

### 3.3 Combos: bonus base vs modificado por dobles

- **Decisión**: tabla en `src/server/scoring/rules.ts`. `COMBO_BONUS.base = {3:5, 5:15, 10:50}`; `COMBO_BONUS.modified = {3:3, 5:5, 10:9}` cuando la racha contiene alguna doble acertada.
- **Razón**: una doble que acierta vale 5pts (mitad del simple). Si esa racha llega a hito, recompensar igual sería incoherente. Negociado en `docs/scoring.md`.

---

## 4. Internacionalización (i18n)

### 4.1 next-intl con `localePrefix: "as-needed"`

- **Decisión**: 4 locales — `es` (default), `en`, `fr`, `ar`. El default no lleva prefix; los demás sí (`/en/inicio`, `/ar/inicio`).
- **Razón**: SEO friendly + URL limpia para el público hispanohablante (audiencia principal).

### 4.2 Mensajes en `messages/<locale>.json`

- **Decisión**: archivos planos en la raíz, no en `src/i18n/messages/`. La proposal del shell decía `src/i18n/messages/` por error; la realidad del repo es `messages/`.
- **Razón**: convención de next-intl. No se quiere mezclar mensajes (que el equipo de copy edita) con código TS.

### 4.3 RTL en árabe

- **Decisión**: `<html dir="rtl">` cuando `locale === "ar"`. Las clases Tailwind lógicas (`start-*`/`end-*`, `ms-*`/`me-*`) se reorientan solas. **Los emojis de bandera no se voltean** porque son glyphs Unicode.
- **Razón**: el árabe es lengua mundial; ignorarlo cierra una audiencia.

### 4.4 Noto Color Emoji como fallback

- **Contexto**: en Windows los emojis de bandera (regional indicator pairs) no rinden.
- **Decisión**: se carga Noto Color Emoji desde Google Fonts y se añade al final de la cadena `font-family` del body.
- **Razón**: garantiza que las banderas se ven en cualquier SO sin obligar al usuario a instalar fuentes.

---

## 5. Auth

### 5.1 Auth.js v5 + Google provider único

- **Decisión**: Google OAuth como único provider. No email/password.
- **Razón**: el espacio social del producto vive con identidades reales; mantener 1-clic reduce la fricción y elimina la superficie de password reset.

### 5.2 `trustHost` auto en dev

- **Decisión**: `trustHost: env.NODE_ENV !== "production" || env.AUTH_TRUST_HOST`. En dev se confía automáticamente; en producción solo si la env var está activa.
- **Razón**: localhost en dev sin configuración manual; en producción se exige el opt-in para evitar sorpresas en deploys fuera de Vercel.

### 5.3 Route group `(app)` para área privada

- **Decisión**: rutas privadas viven en `src/app/[locale]/(app)/<page>`. El `layout.tsx` del group llama `auth()` y redirige a `/<locale>` si no hay sesión.
- **Razón**: un único punto de guard. Añadir una página nueva (`/partidos`, `/ranking`, ...) no requiere repetir el check.
- **Fecha**: 2026-05-11.

---

## 6. Match-data — providers + adapter

### 6.1 Dos capas de transformación: raw → `ProviderMatch` → `MatchOutcome`

- **Decisión**: el parser convierte el shape nativo a `ProviderMatch` (provider-específico → modelo agnóstico). El adapter convierte `ProviderMatch` a `MatchOutcome` (modelo agnóstico → input del engine).
- **Razón**: añadir `LiveScoreApiProvider` solo requiere un parser nuevo; el adapter no se toca.

### 6.2 `fetcher` inyectable en el provider

- **Decisión**: `createApiFootballProvider({ apiKey, baseUrl?, fetcher? })`. Si se omite, usa el `fetch` global.
- **Razón**: tests sin red sin necesidad de `vi.mock("node:fetch")` ni MSW.

### 6.3 `ProviderError` tipado con `code`

- **Decisión**: enum `ProviderErrorCode` (`auth_failed | plan_limited | rate_limited | not_found | bad_request | network_error | parse_error | unknown`).
- **Razón**: el caller (cron handler, futuro failover) puede inspeccionar `code` y reaccionar (`plan_limited` → activar provider secundario; `rate_limited` → backoff).

### 6.4 Integration test opt-in con `skipIf`

- **Decisión**: el integration real (`api-football.integration.test.ts`) usa `describe.skipIf(!process.env.API_FOOTBALL_KEY)`. Sin la key se skipea silenciosamente; con la key consume **1 request** del cupo diario.
- **Razón**: CI no necesita la key para validar; localmente cualquiera con la key valida contra la API real. No agotar el cupo en CI con la key real (100 req/día free, 7500/mes Pro).

---

## 7. Match-data — pipeline (cron + reconciler)

### 7.1 Reconciler puro, I/O en el orquestador

- **Decisión**: `reconcileMatch(current, snapshot, teamMap) → ReconcileResult` (insert/update/noop/skip) es pure function. La I/O (read `current`, write patch, transacciones) vive en `syncFixtures` con el `MatchRepo`.
- **Razón**: 21 casos de reglas (no retroceder lock, no sobreescribir scores con null, mapear penalty, etc.) testados sin abrir Postgres.

### 7.2 Scores `null` del provider **no** sobreescriben

- **Decisión**: si `snapshot.scoreAt90 === null`, el reconciler no incluye `homeScore`/`awayScore` en el patch.
- **Razón**: cuando un partido entra en `live`, el provider deja `scoreAt90 = null` (todavía no es regulación final). Si sobreescribiéramos, perderíamos el marcador real previo. Lo mismo aplica a `scoreAtExtra` y a `penaltyWinner`.

### 7.3 Sync con API-Football: pull periódico desde un cron externo

- **Contexto**: el patrón "frontend ↔ backend ↔ provider" debe ser claro. Frontend va con push (SSE/WebSocket) hacia el backend; backend ↔ provider hace pull porque API-Football no expone webhooks ni websockets en ningún plan.
- **Decisión inicial (2026-05-12)**: arrancamos sin ningún cron — solo `curl` manual al endpoint. `vercel.json` no declara crons (la app ya no corre en Vercel; está en Railway).
- **Decisión actualizada (2026-05-14)**: activamos un **cron externo en GitHub Actions** (`.github/workflows/sync-fixtures.yml`, `*/15 * * * *`) que llama `POST /api/cron/sync-fixtures` contra el dominio de Railway. El endpoint exige `Authorization: Bearer <CRON_SECRET>` cuando esa env var está configurada en Railway; el workflow inyecta el mismo valor desde `secrets.CRON_SECRET` en GitHub.
- **Razón para subirlo ya** (a pesar de no haber SSE todavía):
  1. El sync trae fixtures, detecta transiciones a `finished` y dispara `processFinishedMatch` (decisión [7.6 / 12.3](#123-scoring-se-dispara-en-transición-a-finished-durante-el-sync)). Sin cron, sin scoring automático.
  2. El usuario no quiere depender de `curl` manual — "al final tendrás que hacer lo mismo con el Mundial y nada será manual".
  3. Cabe en el free tier: `*/15` con una sola liga = ~96 req/día (límite 100/día). Si añadimos más ligas, bajamos a `*/30` o partimos en dos workflows con ventanas distintas.
- **Por qué fuera de Railway**: no queremos depender de un scheduler propio de la plataforma (Railway no lo expone de forma estable y atarnos a Vercel/Railway hace el cambio doloroso). GitHub Actions es gratis, portable y ya tenemos el repo allí.
- **Modelo de auth**: el endpoint en local acepta cualquier POST si no hay `CRON_SECRET`; en cuanto se configura, exige el bearer. Defensa contra que un tercero descubra la URL en Railway.
- **Revisar cuando**: aterrice `add-leaderboard-sse`. El cron NO desaparece — el push solo cambia el último tramo (BD → cliente). Sí se revisará la cadencia: ventanas activas (durante kickoffs) más agresivas, off fuera. Posiblemente dos workflows con schedules distintos.

### 7.4 Cron handler puro separado del wiring Next

- **Decisión**: `handler.ts` recibe `(req, deps)` y devuelve `{ status, body }`. `route.ts` solo cablea `NextResponse` + dependencias.
- **Razón**: testeable sin levantar Next.js. 10 casos de auth + outcomes cubiertos con un repo en memoria.

---

## 8. App shell (área logada)

### 8.1 Shell solo para área logada

- **Decisión**: el `<AppShell>` (TopNav + BottomNav + sprite + avatar + bell) **no** se usa en la landing pública `/`. La landing mantiene su nav actual (LanguageSwitcher + JoinCta o AccountMenu).
- **Razón**: la landing es un funnel de conversión; el shell con tabs sería ruido.

### 8.2 `usePathname` vs prop pathname

- **Decisión**: TopNav y BottomNav son **client components** que usan `usePathname()` de `next-intl/navigation`.
- **Razón**: los server components no tienen acceso al pathname sin parsing manual de headers. El coste (un par de client components mínimos) es despreciable frente a la complejidad del parsing.

### 8.3 Refactor mínimo en `AccountMenu` con `trigger?: ReactNode`

- **Decisión**: el `AccountMenu` existente acepta ahora un prop `trigger` opcional. Si se pasa, se usa como contenido del botón; si no, mantiene el look anterior (chip con avatar + hamburger).
- **Razón**: el shell quiere el avatar con ring conic dorado dentro del top-nav; la landing pública sigue queriendo el chip con hamburger. Un solo componente, dos triggers.

### 8.4 Sprite SVG inline compartido

- **Decisión**: `<ShellIconSprite>` define todos los `<symbol>` (home/ball/trophy/medal/bell) una sola vez en el árbol y los tabs los referencian con `<use href="#ico-*">`.
- **Razón**: bundle más ligero que importar una librería de iconos; cambio de color vía `currentColor`; SSR sin descarga extra.

---

## 9. Home dashboard `/inicio`

(Capability en construcción al cierre de este push — ver `openspec/changes/add-home-dashboard/`.)

### 9.1 Mini-leaderboard reusa el dataset de `add-leaderboard-public`

- **Decisión**: `getMiniLeaderboard(userId)` llama a la misma función que la landing pública pero pide `top: 5, includeMe: true`.
- **Razón**: una sola fuente de verdad; el cuándo y el cómo de ranking se gestionan en un sitio.

### 9.2 Placeholders visibles para bloques sin datos

- **Decisión**: la live card sin goles parciales muestra "Se calcula al final del partido"; la card de ranking sin histórico muestra "Empezamos a registrar el 11 de junio".
- **Razón**: la decisión 2026-05-11 fue "implementar lo que se pueda; placeholder visible para el resto" — preferimos un dashboard parcialmente "real" antes que UI mocked al 100%. Cuando aterrice `add-live-scoring` y `add-ranking-history` los placeholders se sustituyen sin tocar el resto.
- **Fecha**: 2026-05-11.

### 9.3 Floaters condicionales por `prefers-reduced-motion`

- **Decisión**: el componente `<Floaters>` no renderiza nodes si el usuario tiene `prefers-reduced-motion: reduce`.
- **Razón**: respeto a accesibilidad. Es decoración pura — el contenido no pierde nada.

### 9.4 Live vs Próximo partido

- **Decisión**: si hay match `status=live`, header rojo "En vivo ahora" + live card. Si no, header "Próximo partido" + card con countdown. Si no hay ninguno, la sección entera no se renderiza.
- **Razón**: 2026-05-11 — preferimos "Próximo partido" como fallback frente a esconder la sección, para que el usuario siempre vea acción inminente cuando la haya.

---

## 10. Formato de números y fechas

### 10.1 Helpers puros vs `toLocaleString`

- **Contexto**: Node 22 ships con `small-icu` en muchas distros, por lo que `(4820).toLocaleString("es-ES")` devuelve `"4820"` en vez de `"4.820"`.
- **Decisión**: helpers puros en `src/lib/format/` — `formatPointsEs(n)` para miles con `.`, `formatMatchDate(d, locale, today)` para Hoy/Mañana/fecha corta. **No** se usa `toLocaleString` en componentes UI.
- **Razón**: deterministic entre runtimes (Vercel, dev local, CI), sin depender del ICU del Node de turno. Permite tests sin variar el entorno.
- **Fecha**: 2026-05-10.

---

## 11. Tests y CI

### 11.1 Pirámide: pura > integración > e2e

- **Decisión**: cada feature tiene tests unitarios para funciones puras (la mayoría del valor) + integration mínimos contra DB real opt-in + e2e mínimos (Playwright).
- **Razón**: feedback rápido en dev (<2s todo el suite offline), confianza alta antes del Mundial.

### 11.2 Mocks compartidos: `renderWithProviders`

- **Decisión**: helper único en `src/test/render-with-providers.tsx` que envuelve cualquier component test con `NextIntlClientProvider` cargando `messages/es.json`.
- **Razón**: 30+ tests usan locale español; aislar el provider en un único punto.

### 11.3 Tests offline obligatorios; integration tests opt-in

- **Decisión**: cualquier test que hable con la red o con una BD real se gateа con `describe.skipIf(!process.env.<KEY>)`.
- **Razón**: CI no debe necesitar credenciales para validar PRs.

---

## 12. Despliegue

### 12.1 Railway como plataforma all-in-one para el entorno de pruebas

- **Contexto**: hace falta un entorno accesible desde el móvil para validar el flujo end-to-end (login, predicciones, navegación) sin tener que arrancar local cada vez. **No es producción pública** — es la sandbox personal del autor. La decisión de plataforma para el día del Mundial se tomará cuando se acerque ese momento.
- **Decisión (2026-05-14)**: **Railway** para web + Postgres en un único dashboard.
- **Razón** (en este uso):
  1. Single panel, single factura.
  2. Sin hibernación (Auth.js + Google OAuth no falla por cold start).
  3. ~$5/mes incluidos en plan Hobby; con un solo usuario probando, cabe sin pagar adicional.
  4. Github push → deploy automático.
- **Revisar cuando**: la web salga de fase de pruebas y se vaya a promocionar. Entonces hay que evaluar:
  - Si Railway escala horizontalmente lo suficiente para los picos del Mundial (alternativa: Fly.io shared multi-región o Hetzner con autoscaling manual).
  - SSE en producción: cuando aterrice `add-leaderboard-sse` medir saturación real.
  - Custom domain + SSL, backups automáticos diarios, PR environments para staging.
- **Documentación operativa**: ver `docs/deployment.md`.

### 12.2 Migraciones aplicadas en deploy, no a mano

- **Contexto**: la primera vez que desplegamos en Railway las tablas no existían y el login fallaba con `relation "accounts" does not exist`. La opción "lanza `npm run db:push` desde tu máquina apuntando a la BD remota" funciona pero exige acordarse cada vez, y `db:push` no respeta el journal de migraciones.
- **Decisión (2026-05-14)**: configurar **Pre-Deploy Command = `npm run db:migrate`** en Railway. El propio deploy aplica las migraciones pendientes antes de arrancar el server.
- **Razón**:
  1. Una sola fuente de verdad sobre cuándo se aplican (en el deploy).
  2. `drizzle-kit migrate` respeta el journal — solo aplica las nuevas.
  3. Si las migraciones fallan, el deploy se cancela: no se arranca un server contra una BD inconsistente.
  4. Funciona igual en futuros entornos (cualquier copia o nuevo deploy se prepara solo).
- **Caveat**: no mezclar `db:push` (sin journal) con `db:migrate` (con journal) sobre la misma BD. En Railway usamos exclusivamente `migrate`. En local sigue siendo válido `db:push` durante desarrollo iterativo.

### 12.3 Scoring se dispara en transición a finished durante el sync

- **Contexto**: el scoring engine ya existía como pure function. Faltaba el orquestador que lee predictions, las puntúa y persiste resultados. Necesitábamos un sitio donde "engancharlo".
- **Decisión (2026-05-14)**: el `syncFixtures` acepta un hook opcional `onMatchFinished(matchId)`. El route handler del cron lo cabla con `processFinishedMatch`. El hook se invoca SOLO cuando un match transiciona a `finished` durante el sync.
- **Razón**:
  1. El sync es ya el momento donde detectamos cambios canónicos en `matches`. Es coherente lanzar el scoring inmediatamente.
  2. `processFinishedMatch` es idempotente — si llega a procesarse dos veces no duplica `point_events`. Eso da margen ante retries del sync.
  3. La interfaz por hook permite que `syncFixtures` siga testeable sin acoplar a Drizzle ni al pipeline en tests offline (los tests del orquestador pasan un stub `onMatchFinished: undefined`).
- **Caveat**: si un partido finished se inserta directamente en BD sin pasar por el sync (e.g. seed manual), el scoring NO se dispara. Para esos casos hay que llamar `processFinishedMatch(db, matchId)` a mano.

### 12.4 Puntos provisionales calculados al vuelo, no persistidos

- **Contexto**: cuando un partido está en `live`, el usuario quiere ver "vas ganando 30 puntos porque tu predicción coincide hasta ahora".
- **Decisión (2026-05-14)**: pure helper `computeProvisionalScore(snapshot, prediction, streakBefore)` que invoca el mismo engine con un `MatchOutcome` simulado (`status="finished"` + scores actuales). Se calcula en `getLiveMatchForUser` y se devuelve en el view model. **NO se persiste nada**. La racha no avanza con provisionales (regla cerrada de `docs/scoring.md`).
- **Razón**:
  1. El usuario ve el feedback inmediato sin contaminar el estado canónico.
  2. Un cambio de marcador (ej. gol del rival) cambia el provisional sin tocar BD.
  3. Cuando aterrice SSE solo hay que empujar el `LiveMatchView` actualizado; el cliente no calcula nada.

### 12.5 Auto-refresh client-side mientras hay live (polling tonto)

- **Contexto**: hasta que aterrice `add-leaderboard-sse`, el usuario tendría que pulsar F5 para ver el nuevo marcador o sus puntos provisionales actualizados.
- **Decisión (2026-05-14)**: componente client `<LiveAutoRefresh>` que llama `router.refresh()` cada 30s. Solo se monta si `data.live` no es null.
- **Razón**:
  1. Trivial de implementar (~20 líneas) y suficiente para validar end-to-end en este sprint.
  2. `router.refresh()` re-evalúa el SSR sin recargar la página; el usuario mantiene su scroll y estado.
  3. Si solo hay un user activo en este entorno de pruebas, 1 request cada 30s al server es despreciable.
- **Revisar cuando**: aterrice `add-leaderboard-sse`. Este componente se sustituye por un EventSource sin cambiar la UI del dashboard.

### 12.6 Cron de sync: GitHub Actions `*/15`, externo a Railway

- **Decisión (2026-05-14)**: activamos el workflow `.github/workflows/sync-fixtures.yml` con `schedule: */15 * * * *` + `workflow_dispatch`. El job hace `curl -X POST` contra `https://<dominio>.up.railway.app/api/cron/sync-fixtures` con `Authorization: Bearer <CRON_SECRET>` si el secret está configurado. Setup completo en `docs/deployment.md` §9.
- **Razón**: ver decisión 7.3. Resumen: sin cron, ningún partido cambia de estado y por tanto el scoring no se dispara — no es viable depender de `curl` manual ni en pruebas. GitHub Actions evita acoplarnos al scheduler de la plataforma de hosting.
- **Coste de API**: `*/15` × 1 liga ≈ 96 req/día (free tier 100/día). Margen pequeño; si añadimos La Liga + otra competición, bajar a `*/30` o partir en dos schedules con ventanas.
- **Si el cron falla**: GitHub Actions notifica al owner por email. El endpoint sigue siendo idempotente, así que un tick perdido se recupera en el siguiente. Para forzar manual: Actions → Sync fixtures → Run workflow.

---

## 14. Security hardening

### 14.1 CRON_SECRET obligatorio en producción

- **Decisión (2026-05-15)**: `src/lib/env.ts` añade un `superRefine` que exige `CRON_SECRET ≥ 32 chars` cuando `NODE_ENV === "production"` y NO estamos en `NEXT_PHASE === "phase-production-build"`. En dev/test sigue opcional para no romper `curl` manual.
- **Razón**: antes era opcional en runtime, y el guard de `handleCronRequest` solo aceptaba auth ausente fuera de producción. Si alguien levantaba el server sin `CRON_SECRET` por descuido, el endpoint público quedaba abierto. Ahora el deploy falla al arrancar con un mensaje explícito.
- **Build vs runtime**: Railway inyecta env vars solo en runtime; `next build` corre con `NODE_ENV=production` pero sin las vars cargadas. Detectamos esa fase con `NEXT_PHASE` para no fallar el build local ni el de CI.

### 14.2 Security headers en `next.config.ts`

- **Decisión (2026-05-15)**: `next.config.ts` define un `async headers()` con CSP (enforcing), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (denegando geo/mic/cam/payment) y `Strict-Transport-Security` (solo en prod).
- **CSP enforcing desde el principio**: la app es pequeña; cualquier rotura por una directive demasiado estricta se detecta rápido. Si fuese una migración con tráfico real, empezaríamos en `Report-Only`.
- **`script-src`**: en dev incluye `'unsafe-inline'` y `'unsafe-eval'` por hot-reload + React DevTools. En prod queda solo `'self'`.
- **Allowlist conocidas**: `media.api-sports.io` (logos teams), `*.googleusercontent.com` (avatars Google), `v3.football.api-sports.io` (connect-src para llamadas futuras desde cliente).

### 14.3 Gitleaks en CI

- **Decisión (2026-05-15)**: workflow `.github/workflows/gitleaks.yml` corre en cada PR y push a `main` con `gitleaks/gitleaks-action@v2`. Si detecta un patrón de secret en el diff, falla el build.
- **Motivación concreta**: 2026-05-14 se filtraron `API_FOOTBALL_KEY` y `GOOGLE_CLIENT_SECRET` durante debugging en chat. Con Gitleaks el commit habría sido bloqueado si esas keys hubieran llegado a un fichero.
- **`.gitleaks.toml`**: allowlist con paths de `.env.example`, tests con fixtures, docs/openspec, y regex de strings tipo `<placeholder>`. Si Gitleaks da falso positivo, se añade ahí.

### 14.4 Runbook de rotación

- `docs/security.md` con pasos exactos para rotar cada secret (`AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `API_FOOTBALL_KEY`, `CRON_SECRET`, `DATABASE_URL`). Pensado para usarse en pánico — paso a paso, qué pasa con las sesiones existentes, dónde se propaga.

---

## 14.5 Guardrails contra operaciones destructivas (2026-05-18)

- **Contexto**: el 2026-05-18, durante un wipe de QA para repoblar `matches` desde api-football, el script `dev-reset-matches` borró las predicciones y puntos de usuarios reales de producción además de los seeds. Ver `docs/incident-2026-05-18-data-wipe.md` para el post-mortem completo.
- **Decisión**: `scripts/dev-reset-matches.ts` cuenta cuántos usuarios reales tienen datos no triviales (≥1 `point_event` o `user_points.total_points > 0`) antes de aceptar `--apply`. Si hay >0, exige un segundo flag explícito `--really-prod`. El mensaje de abort indica el alternative path: `scripts/recompute-user-points.ts` (idempotente, no destructivo).
- **Decisión adicional**: prohibido mantener endpoints HTTP admin destructivos en `main`. Si se necesita una op puntual, se crea en branch efímera + se borra inmediatamente tras uso.
- **`point_events` como source-of-truth**: `user_points` es DENORMALIZACIÓN. Modificarlo via SQL bypassa el audit trail. El path correcto para resincronizar es `point_events` → `recompute-user-points.ts`.

## 14.6 Cooldown nombre/avatar 48 h → 1 h (2026-05-18)

- **Contexto**: el cooldown original de 48 h era sobre-protección para fase muy temprana. En QA generaba fricción al editar perfil pero NO aportaba contra trolleo real (un troll espera 48 h sin problema).
- **Decisión**: bajar a 1 h. Suficiente para evitar spam pero ágil para corregir errores tipográficos. La UI muestra countdown ("48 min") junto al elemento editable; click cuando cooldown activo dispara toast en vez de abrir el input.

## 14.7 Toggle `showHistory` en privacy (2026-05-18)

- **Contexto**: usuarios quieren decidir si mostrar su histórico de predicciones a visitantes del perfil. La privacy global (`public/friends_only/private`) no era granular suficiente — querían poder ser públicos sin exhibir el histórico.
- **Decisión**: añadir `showHistory: boolean` (default `true`) en `UserPrivacy`. Si `true` y el visitante puede ver el perfil, ve las últimas 5 predicciones del owner. El owner siempre ve su propio histórico independientemente del toggle.

## 14.8 Achievements gate por env var (2026-05-18)

- **Contexto**: en los primeros partidos del Mundial, un user que predice por suerte el día 1 podría desbloquear logros de tier alto (GOAT, mítico) que distorsionarían el ranking mientras la mayoría todavía no ha empezado.
- **Decisión**: `evaluateAndUnlock` lee `env.ACHIEVEMENTS_MIN_FINISHED_MATCHES` (default 0 = sin gate). Si > 0 y el número global de `matches.status='finished'` es menor al threshold, NO desbloquea nada. Set a 5 en Railway antes del kickoff. Tras pasar threshold, los unlocks retroactivos se sueltan en el siguiente match scored de cada user.
- **Alternativa rechazada**: lock por tier (común desde día 1, GOAT tras 20). Más fino pero opaco para el user.

## 14.9 Cadencia de backups dual (2026-05-18)

- **Contexto**: backup diario era suficiente off-season. Durante el Mundial perder hasta 24h de actividad sería inaceptable.
- **Decisión**: dos workflows — `db-backup.yml` (diario 03:00 UTC, prefijo `daily/`, retención 30 días) activo todo el año. `db-backup-tournament.yml` (cada 6h, prefijo `tournament/`, date guard 11 jun → 19 jul 2026) añade granularidad fina solo durante el torneo. Lifecycle: `daily/` 30 días, `tournament/` 14 días.

## 14.10 Plan Pro de api-football (2026-05-17)

- **Contexto**: free tier limitado a 100 req/día y restringido a temporadas 2022-2024. Insuficiente para el Mundial 2026.
- **Decisión**: contratado plan Pro $19/mes (7500 req/día). **Allowlist de IPs vaciado** en el dashboard del provider porque Railway usa IPs dinámicas; auth queda únicamente por header `x-apisports-key`. Config detallada en `docs/api-football-config.md`.

## 14.11 Ajustes en página dedicada `/ajustes` (2026-05-18)

- **Contexto**: privacy + push + delete vivían como acordeón dentro de `/u/<username>`, owner-only. Forzaba al user a pasar por su perfil público para configurar su cuenta.
- **Decisión**: nueva ruta `/ajustes` accesible desde el dropdown del avatar (top right), justo debajo de "Mi perfil". El acordeón se elimina y la página `/u/<username>` queda como perfil público puro.

---

## 14.12 Grupos de competición (2026-05-19)

- **Contexto**: ArenaCup26 tenía solo un ranking global único; jugar contra "mi cuñado y mi peña" era el caso de uso obvio pero invisible. Reescribir el scoring por grupo era inaceptable: complicaba la BD y abría divergencias entre puntos globales y de grupo.
- **Decisión**: el ranking de un grupo es un **filtro + reorder** sobre el mismo `user_points` que alimenta el global. Cuatro tablas nuevas (`groups`, `group_memberships`, `group_invitations`, `group_links`) + 6 valores nuevos en `notification_kind` + el logro `team-spirit` añadido al catálogo. Caps: 3 grupos/user, 5–100 miembros/grupo, 5 links/grupo.

## 14.13 Leave/Expel siempre congela el perfil (2026-05-19)

- **Contexto**: la implementación inicial de `leaveGroup` exponía un toggle "Mantener mi perfil congelado". Resultaba confuso y rompía la coherencia del ranking histórico. `expelMember` directamente borraba la fila, lo que impedía mostrar al ex-miembro como referencia.
- **Decisión**: ambos flujos hacen lo mismo — `left_at = now()` + snapshot de `user_points` a `frozen_*`. Eliminado el toggle de UI. Si el user vuelve a ser invitado, la misma fila se reactiva (`left_at = NULL`, `frozen_* = NULL`) y conserva todo el historial. Badge "Ha salido" junto al nombre mientras esté frozen, desaparece al re-incorporarse.

## 14.14 Grupos privados aparecen en descubrir con candado (2026-05-19)

- **Contexto**: la implementación inicial filtraba los privados de `/descubrir`. Resultado: el buscador estaba mayormente vacío.
- **Decisión**: ahora `/descubrir` muestra TODOS los grupos no borrados (privados + públicos + en los que ya eres miembro). Los privados aparecen con candado 🔒; click → popup "solo por invitación o link del admin". Da vida al buscador como "pista" social sin filtrar miembros ni ranking. Acceso directo por URL al detalle de un privado sigue dando 404.

## 14.15 Ranking nav redesign — Global / Amigos / Grupos (2026-05-19)

- **Contexto**: `/ranking` mostraba solo el global. La feature de grupos quedaba escondida en `/social`.
- **Decisión**: `/ranking` ahora tiene 3 tabs URL-driven (`?scope=`):
  - `?` (default) → Global, SSE-powered.
  - `?scope=amigos` → viewer + amigos aceptados (tab oculta si no tienes amigos).
  - `?scope=grupos&g=<id>` → sub-nav con cada grupo del viewer + CTA "+ Nuevo". Empty state si no tienes grupos.
- Reutiliza `PodiumCard` y `RankRow` del módulo global. El podio siempre se renderiza con placeholders animados si hay <3 miembros activos. Ex-miembros congelados nunca al podio.

## 14.16 Gate de logros con bypass para acciones sociales (2026-05-19)

- **Contexto**: el gate `ACHIEVEMENTS_MIN_FINISHED_MATCHES` (decisión 14.8) bloqueaba TODOS los logros hasta jugar N partidos. Pero `team-spirit` (crear/unirse a grupo) es una acción social, no rendimiento — debería desbloquearse al instante.
- **Decisión**: nueva lista `GATE_BYPASS` en `evaluateAndUnlock` con los logros exentos del gate. Por ahora solo `team-spirit`. `evaluateAndUnlock` ya no retorna `[]` con el gate activo: marca `gateActive=true` y filtra rule a rule. `scripts/bootstrap.ts` corre `backfillTeamSpirit` en cada pre-deploy (idempotente, sin notificaciones) para reconciliar usuarios con grupos pre-existentes a los que el bug del gate les había impedido recibir el logro.

## 14.18 Bots para poblar el cold-start del Mundial (2026-05-19, propuesto)

- **Contexto**: día 1 del Mundial podemos abrir con ~5-20 usuarios reales. Con tan pocos, el ranking se ve abandonado, los logros (`top-100`, `runner-up`, `king-of-the-moment`) son triviales, y un user nuevo no siente que "supere" a nadie. Hoy parcheamos con 7 placeholders cosméticos hardcoded (sin historial real, sin perfil completo).
- **Decisión**: reemplazar los 7 placeholders por **27 "bots"** — usuarios sintéticos en `users` con `is_bot=true` que reusan TODA la infra (scoring, ranking, achievements, perfil público). Predicen aleatoriamente fase de grupos al activarse y "mueren" naturalmente en octavos (no predicen eliminatorias), permitiendo que users reales les superen orgánicamente.
- **Reglas duras**:
  - `is_bot` flag interno, NUNCA expuesto en API/UI.
  - Bots no inician sesión (email sintético + no `accounts` row).
  - Bots no entran en grupos privados (catálogo no los inscribe).
  - Bots no reciben push (sin `push_subscriptions`).
  - Personalidades de predicción: 70% simple, 20% mixed, 10% daredevil — distribuye naturalmente el ranking.
  - Friend/group requests a bots → cron diario las auto-rechaza tras 48h.
- **Migración**: los 7 placeholders previos se convierten en los primeros 7 bots del catálogo. `seedLeaderboardPlaceholders` se elimina.
- **Trasparencia**: NO se anuncia públicamente la existencia de bots. Patrón estándar de cold-start. Si un user descubre y pregunta, respuesta honesta — no negar pero tampoco promocionar.
- Detalles en [`docs/bots.md`](bots.md) y la propuesta `add-bot-users`.

## 14.17 Notificaciones de grupo: routing y push opt-in (2026-05-19)

- **Contexto**: 6 kinds nuevos para grupos (`group_invited`, `group_joined`, `group_left`, `group_expelled`, `group_admin_transferred`, `group_deleted`).
- **Decisión**:
  - Todos resuelven a `/social` en `resolveNotificationHref` (no a deep-link al grupo) para mantener UI consistente con el hub. La card en `/social` hace el deep-link concreto.
  - Push ACTIVO solo para time-sensitive: `group_invited` (te invitan), `group_expelled` (te echan), `group_admin_transferred` (eres el nuevo admin).
  - El resto (joins, leaves, deletes) son in-app silenciosos — eventos de baja prioridad que no merecen interrumpir.

---

## 15. Roadmap diferido (no decidido todavía)

Estas son capabilities propuestas pero **no abiertas** todavía. Se documenta solo el alcance esperado para que cuando llegue el momento de drafter la propuesta haya un contexto previo.

- **`add-leaderboard-sse`**: SSE pipeline que consume cambios en `matches` y emite re-rankings. Probablemente Redis pub/sub como bus.
- **`add-prediction-flow`**: submit/edit de predicciones desde el detalle de partido. Idempotente y respetando el lockout en kickoff.
- **`add-scoring-pipeline`**: recálculo de puntos cuando una fila `matches` cambia (cron post-sync o trigger DB).
- **`add-ranking-history`**: snapshot semanal del ranking para alimentar sparkline + delta del dashboard.
- **`add-live-scoring`**: exponer goles parciales del provider durante `live` para activar puntos provisionales en tiempo real.
- **`add-match-data-providers-livescore`**: round (b) — `LiveScoreApiProvider` + `FailoverProvider`.
- **`add-match-data-resilience`**: retries con backoff exponencial + circuit breaker + caching.
- **`add-notifications`**: dropdown real del bell del shell.
- **`add-matches-page`, `add-ranking-page`, `add-achievements-page`, `add-public-profile-page`**: las cuatro páginas del área logada que faltan tras `/inicio`.
- **`add-fixture-seed-wc2026`**: siembra los 48 equipos + entries iniciales de `team_external_ids`.
