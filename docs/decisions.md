# Dosier de decisiones técnicas — WebMundial 26

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

### 7.3 Sync con API-Football: pull manual, NO cron automático

- **Contexto**: el patrón "frontend ↔ backend ↔ provider" debe ser claro. Frontend va con push (SSE/WebSocket) hacia el backend; backend ↔ provider hace pull porque API-Football no expone webhooks ni websockets en ningún plan.
- **Decisión (2026-05-14)**: el cron de Vercel está **desactivado**. `vercel.json` ya no declara crons. El endpoint `POST /api/cron/sync-fixtures` se mantiene operativo para disparo manual (con `curl`) o cron externo cuando aterrice `add-leaderboard-sse`.
- **Razón**:
  1. En fase de desarrollo no necesitamos un cron quemando cupo del free tier (100 req/día).
  2. El cron automático sin SSE no aporta nada al usuario — los cambios en BD no llegan al navegador sin push.
  3. Decisión de re-enable se tomará junto con la activación de SSE y midiendo cupo real del Mundial.
- **Revisar cuando**: aterrice `add-leaderboard-sse`. Entonces se evalúa cadencia + cupo necesario y se vuelve a activar (probablemente con `*/15` durante kickoffs + off fuera de ventanas activas).

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

### 12.3 Cron de sync deshabilitado en producción inicial

- **Decisión**: `vercel.json` sin crons (decisión 7.3). En Railway tampoco activamos cron automático en el primer despliegue. El endpoint `POST /api/cron/sync-fixtures` queda funcional para disparo manual con bearer.
- **Razón**: hasta que aterrice `add-leaderboard-sse` el cron quema cupo de api-football sin que nadie observe los datos en tiempo real. Activar al mismo tiempo que SSE.

---

---

## 13. Roadmap diferido (no decidido todavía)

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
