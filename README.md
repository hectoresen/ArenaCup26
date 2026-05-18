# ArenaCup26

Plataforma social y competitiva alrededor de la **Copa Mundial 2026** (Canadá · México · USA). Los usuarios predicen partidos, compiten en un ranking global y entre amigos, y desbloquean logros a lo largo del torneo.

## ¿Qué es ArenaCup26?

Una webapp en la que registrarse con Google, predecir los 104 partidos del Mundial, ganar puntos según los aciertos, escalar posiciones en un ranking en tiempo real e invitar a amigos para competir uno contra uno. No es un servicio de apuestas: no hay dinero ni premios materiales — es un juego de predicciones para que el torneo se vea con más emoción y con tus amigos.

## Funcionalidades

### Predicciones y puntuación

- **3 tipos de predicción por partido**: simple (ganador o empate), exacta (marcador), o doble cobertura (`1X`, `X2`, `12`). Cada tipo tiene su propio valor en puntos.
- **Sistema de combos**: aciertos consecutivos disparan bonus en hitos de 3, 5 y 10. La racha se mantiene en `user_points.streak` y se reinicia al fallar.
- **Marcador en vivo**: durante un partido en curso, los puntos provisionales se calculan al vuelo (no se persisten) para previsualizar lo que ganarías si acabara así.
- **Eliminatorias**: en octavos/cuartos/semis/final/3er puesto, el marcador cuenta hasta el final de la prórroga (120 min) y el ganador incluye penaltis. Las dobles `1X` y `X2` no aplican; el empate oficial no existe.
- **Ventana de predicción**: las predicciones se cierran al kickoff del partido.
- **Puntos provisionales** durante un partido en vivo se confirman al `finished` y se descartan si el partido se pospone o cancela.

### Ranking

- **Ranking global inamovible**: todos los users registrados aparecen siempre con su info básica (nombre, bandera, puntos). La privacidad del perfil no oculta al user del ranking — solo decide si su perfil público es visitable.
- **Tie-break** determinista por 5 criterios: puntos → mejor racha histórica → aciertos simples/exactos → número de predicciones → fecha de registro.
- **Indicador en línea**: punto verde junto a la bandera si el user tuvo actividad en las últimas 24 h.
- **Sparkline + delta semanal** en la card "Tu posición" del panel, alimentados por un snapshot diario del ranking.
- **Actualización en vivo**: la página pública del ranking usa Server-Sent Events para refrescar cada 15 s sin recargar.
- **Mini-ranking** en el panel `/inicio` con el Top 5 + tu fila si estás fuera.

### Perfil y privacidad

- **Perfil público** en `/u/<username>`: avatar, bandera, posición, puntos, historial (opcional), logros.
- **3 niveles de privacidad**: `public`, `friends_only`, `private`. El ranking nunca se ve afectado; la privacidad solo controla si alguien puede abrir tu perfil completo o ve un cartel "Perfil privado".
- **Toggle "Mostrar historial públicamente"**: granularidad extra para decidir si los visitantes ven las últimas 5 predicciones del owner en su perfil. Default ON; el owner siempre ve su histórico.
- **Editor inline** del nombre y avatar con cooldown de 1 h entre cambios (evita trolleo sin entorpecer cambios legítimos). UI muestra el countdown ("48 min") antes del próximo cambio permitido. Galería curada de 24 emoji-avatares o foto de Google.
- **AvatarPicker preview → save** explícito: clicar un emoji solo marca selección; "Guardar"/"Descartar" finaliza. Evita cambios accidentales y propagación de cooldown.
- **Stats personales** visibles solo para el dueño del perfil: rachas (actual, mejor, milestones), últimas 5 predicciones, links de invitación.
- **Ajustes de cuenta** accesibles desde el dropdown del avatar (`/ajustes`): privacidad, push notifications, eliminar cuenta.

### Amistad y social

- **Sistema de amigos bidireccional**: enviar/aceptar/rechazar/eliminar solicitudes. CTA contextual en `/u/<username>` que cambia según la relación actual.
- **Bandeja de solicitudes** en `/amigos` con buscador por `@username`.
- **Links de invitación**: el user genera un link único; quien entra con él se convierte automáticamente en amigo en ambos perfiles tras iniciar sesión con Google. Cuando el invitado acierta su primera predicción, el invitador recibe **+10 pts** y el logro `better-with-friends`. Cada link soporta 1 o N usos, se puede rescindir en cualquier momento, y existe un cap de 5 links activos por user.

### Logros

- **24 logros** organizados en 6 tiers: común, raro, épico, legendario, mítico, GOAT. Cada uno con icono SVG propio, descripción y condición de desbloqueo.
- **Catálogo público** visible en cualquier perfil + página `/logros` con progreso por tier.
- **Logros compartibles** (legendarios/míticos/GOAT) llevan un share-chip al hover.
- **Gate de arranque del torneo**: durante los primeros N partidos del Mundial (configurable vía `ACHIEVEMENTS_MIN_FINISHED_MATCHES`, default 0 en QA, set 5 antes del kickoff), `evaluateAndUnlock` no concede ningún logro. Evita que un acierto trivial del día 1 produzca un GOAT desbloqueado.

### Partidos

- **Listado de partidos** con filtros server-side por estado (todos/live/próximos/acabados), fase (todos/grupos/eliminatoria) y "solo mis predicciones".
- **Vista Bracket**: diagrama de eliminatorias del Mundial 26 con secciones por ronda (octavos → final + 3er puesto). Cards compactas que muestran el marcador si jugado, badge "Enviada" si predicho, o CTA "Predecir".
- **Detalle del partido** con info completa, predicción del user y puntos calculados.

### Notificaciones

- **Campana del shell** con bandeja de las últimas 20 notificaciones. Click en cada una navega a la sección correspondiente (`/partidos/...` para resultados, `/amigos` para solicitudes, `/logros` para desbloqueos).
- **7 tipos**: predicción enviada, predicción bloqueada (kickoff reminder), partido terminado, logro desbloqueado, solicitud de amistad, solicitud aceptada, sistema.
- **Web push** activa para 5 kinds time-sensitive (`prediction_sent`, `match_finished`, `achievement_unlocked`, `friend_request`, `friend_accepted`, `prediction_locked`). Service worker propio, opt-in desde `/ajustes`. Sin cookies de terceros.
- **Kickoff reminder**: 30 min antes del kickoff de un partido, los users activos (últimos 30 días) que no hayan predicho reciben un push. Disparado piggyback en el cron de live-scoring; dedup por `notifications.matchId + kind`.

### Internacionalización

- **4 idiomas**: español (canonical), inglés, francés y árabe con soporte RTL nativo.
- **Locale routing**: `/<locale>/...` o cookie. Los copies legales y todo el UI están traducidos al 100 %.
- **Banderas como PNG** (no emoji) para que rendericen en Windows + Chrome donde los regional indicators no se ven.

### Operación y resiliencia

- **Snapshot diario del ranking** vía cron a las 00:05 UTC para alimentar el histórico (delta + sparkline).
- **Sync de partidos (`match-data-sync`)** vía cron cada 3 h con ventana hoy-1d / +7d, filtrado a 7 ligas top (La Liga, Premier, Serie A, Bundesliga, Ligue 1, UCL, MLS) durante la fase pre-Mundial; switch a `MODE=season + LEAGUE_ID=1 + SEASON=2026` para el torneo.
- **Live-scoring** cada 2 min que solo dispara fetch al provider si hay partidos en curso o kickoffs en ±15-30 min; in-band kickoff-reminder push al mismo tiempo.
- **Backup diario** a 03:00 UTC + **backup cada 6 h durante el Mundial** (workflow `db-backup-tournament.yml` con date guard 11 jun → 19 jul). Verificación de integridad inline. `pg_dump` → bucket S3-compatible.
- **Script `recompute-user-points`** idempotente (dry-run por default) reconstruye `user_points` desde `point_events` si se desincronizan.
- **Página de status** pública en `/status` que **pinga al provider real** (api-football `/status` con timeout 3 s, no solo check de env vars) + DB latency.
- **Rate-limiting** por IP en endpoints públicos, sign-up y crons.
- **Monitorización de errores** vía Sentry activo, con scrub de PII en `beforeSend`.
- **Páginas legales** completas en 4 idiomas (privacidad + términos) con contacto `contact@arenacup26.com` integrado. Accesibles sin login.
- **Guardrails contra ops destructivas**: el script `dev-reset-matches.ts` cuenta usuarios reales con datos antes de aceptar `--apply`, y requiere doble flag `--really-prod` si detecta cualquiera. Ver `docs/incident-2026-05-18-data-wipe.md` para el contexto.

---

## Stack técnico

| Capa             | Tecnología                                              |
| ---------------- | ------------------------------------------------------- |
| Framework        | Next.js 15 (App Router + Server Components) · React 19  |
| Lenguaje         | TypeScript estricto · `tsc --noEmit` en CI              |
| Estilos          | Tailwind CSS v4 con `@theme` para tokens del producto   |
| Internacionalización | next-intl 4 con routing dinámico + RTL              |
| Base de datos    | PostgreSQL 16 · Drizzle ORM 0.45 + drizzle-kit          |
| Realtime         | Server-Sent Events nativos (sin librería extra)         |
| Autenticación    | Auth.js v5 con DrizzleAdapter y Google OAuth            |
| Validación       | Zod en server actions, route handlers y env             |
| Rate-limit       | Upstash Redis con contador INCR + EXPIRE                |
| Errores          | Sentry (`@sentry/nextjs`) con beforeSend que scrubea PII|
| Push             | Service Worker propio + librería `web-push` con VAPID   |
| Testing          | Vitest + Testing Library (unit/component) · Playwright (E2E) |
| Lint/format      | Biome (`npm run check`)                                 |
| CI/cron          | GitHub Actions: tests E2E, match-data-sync, snapshot-ranking, live-scoring, db-backup (daily + tournament 6h) |

### Cómo se monta

- **App Router puro**: rutas `app/[locale]/...` con segmentos en grupos `(app)` para el área autenticada. Server Components por defecto; client components solo para UI con estado real.
- **Server actions** para mutaciones (predicciones, friend requests, profile edits, invitaciones, push subscribe). Validación con Zod y revalidación de paths afectados.
- **Drizzle schema** en `src/server/db/schema.ts` como única fuente de verdad; las migraciones se generan con `drizzle-kit generate` y se aplican con `db:migrate` al desplegar.
- **Capas de dominio** separadas en `src/server/<feature>/` (scoring, achievements, friends, invitations, push, ranking-history, notifications, match-data, etc.) con tests unitarios por feature.
- **Middleware** (`src/middleware.ts`) gestiona el routing i18n y la captura de `?invite=<token>` antes de delegar al middleware de next-intl.
- **No state cliente compartido**: todo el state vive en el servidor; cualquier sincronización entre cliente y servidor pasa por SSR + server actions + (donde aplica) SSE.

### APIs y proveedores externos

- **Google OAuth** — autenticación de usuarios vía Auth.js.
- **api-football** (api-sports.io) — fuente primaria de fixtures, marcadores y eventos del Mundial 26. **Plan Pro $19/mes** activo desde 2026-05-17 (7500 req/día); allowlist de IPs vaciado para que Railway pueda llamar. Config detallada en [`docs/api-football-config.md`](docs/api-football-config.md).
- **Upstash Redis** (opcional) — backend del rate-limit. Sin variables → modo noop.
- **Sentry** (opcional) — monitorización de errores server-side. Sin DSN → modo noop.
- **Plausible** (opcional) — analytics privacy-friendly sin cookies. Sin dominio → no se inyecta.
- **Backblaze B2 / Cloudflare R2** (opcional) — bucket S3-compatible para backups diarios.
- **Push providers del navegador** (FCM/Mozilla/Apple) — destino de las notificaciones web push, identificados a través de claves VAPID.

---

## Estructura del repositorio

```
.
├── README.md                  # este archivo (visión + funcionalidades + stack)
├── AGENTS.md                  # convenciones para agentes IA (genérico)
├── CLAUDE.md                  # deltas específicos de Claude Code
├── .env.example               # variables de entorno necesarias
├── docs/                      # documentación humana (ver "Documentación" abajo)
├── drizzle/                   # migraciones SQL versionadas
├── e2e/                       # tests Playwright (golden paths)
├── messages/                  # i18n (es/en/fr/ar)
├── public/                    # assets estáticos: manifest.webmanifest, icon.svg, sw.js
├── scripts/                   # scripts de bootstrap, seeds, etc.
├── src/
│   ├── app/[locale]/          # rutas Next.js
│   ├── components/            # componentes React por feature
│   ├── hooks/                 # hooks compartidos (SSE, etc.)
│   ├── lib/                   # utilidades (auth, env, rate-limit, format, sentry…)
│   └── server/                # dominio servidor por feature
│       ├── achievements/      # catálogo + reglas de unlock
│       ├── db/                # cliente Drizzle + schema
│       ├── friends/           # tabla friendships + queries/actions
│       ├── invitations/       # F4: links + redenciones + payout referral
│       ├── leaderboard/       # snapshot del ranking público
│       ├── match-data/        # provider api-football + pipeline
│       ├── notifications/     # bandeja y creación
│       ├── profile/           # editor de nombre/avatar
│       ├── public-profile/    # query del perfil público
│       ├── push/              # web push (VAPID + sendPushTo)
│       ├── ranking-history/   # snapshots diarios + sparkline
│       └── scoring/           # engine puro + pipeline + tipos
└── openspec/                  # spec-driven development (propuestas abiertas + archivo)
```

---

## Documentación

Toda la documentación humana vive en [`docs/`](docs/). Cada archivo cubre un aspecto del producto o del runbook operativo. Esta es la lectura recomendada por rol:

### Para empezar (todos los roles)

| Archivo                                                | Qué encontrarás                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [`docs/quickstart.md`](docs/quickstart.md)             | Guía paso-a-paso para levantar el proyecto en local en ~5 minutos. OAuth, Postgres en Docker, seeds, troubleshooting comunes. |
| [`docs/glossary.md`](docs/glossary.md)                 | Vocabulario del dominio: predicción simple/exacta/doble, combo, racha, TBD, eliminatoria. Lectura corta y obligada. |

### Para entender el producto

| Archivo                                                | Qué encontrarás                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [`docs/business-rules.md`](docs/business-rules.md)     | Reglas operativas no-scoring: 7 estados de un partido, ventana de predicción, gestión de eliminatorias (prórroga + penaltis), username, eliminar cuenta. |
| [`docs/scoring.md`](docs/scoring.md)                   | Tabla canónica de puntos: cuántos puntos vale un acierto simple, un exacto, una doble, qué bonus dan los combos. Es la fuente de verdad del scoring engine. |
| [`docs/achievements.md`](docs/achievements.md)         | Catálogo formal de los 24 logros: id, título, descripción, tier, trigger, si es compartible. Espejo del seed en código. |
| [`docs/public-profile.md`](docs/public-profile.md)     | Estructura del perfil público `/u/<username>`: identity card + stats + logros + privacidad.                       |

### Para entender la arquitectura

| Archivo                                                | Qué encontrarás                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)         | Vista de 10 000 m: diagrama de flujo (cliente → Next → Postgres), flujos principales (login, predicción, scoring), límites y trade-offs. |
| [`docs/infrastructure.md`](docs/infrastructure.md)     | Diagrama operativo: servicios en producción, configuración, conexiones, dónde vive cada cosa.                    |
| [`docs/decisions.md`](docs/decisions.md)               | Bitácora de decisiones técnicas vigentes. ADRs reducidos: contexto, decisión, consecuencias. Lo que cualquier nuevo dev debe leer antes de proponer cambios estructurales. |
| [`docs/roadmap.md`](docs/roadmap.md)                   | Plan de trabajo consolidado: bloques de producto, capabilities del backlog técnico, ítems aterrizados y pendientes. Se actualiza por sprint. |

### Para operar y mantener

| Archivo                                                | Qué encontrarás                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [`docs/deployment.md`](docs/deployment.md)             | Guía completa de despliegue: variables de entorno requeridas, pasos para subir a una plataforma nueva, troubleshooting del primer arranque. |
| [`docs/security.md`](docs/security.md)                 | Runbook de seguridad: secrets que gestionamos, auditoría de cyber issues (CRIT/WEAK), checklist pre-launch, operativa manual del owner. **§9.5** explica qué es VAPID, cómo funciona el flow end-to-end de web push y cómo activarlo en Railway. |
| [`docs/testing.md`](docs/testing.md)                   | Filosofía y estándares de testing: capas, patrones aceptados, anti-patrones, threshold de cobertura, roadmap para subirlo. Lectura obligada antes de añadir o cambiar tests. |
| [`docs/data-pipeline.md`](docs/data-pipeline.md)       | Cómo llegan los datos a la app: crons, fuentes, flujo gol → ranking actualizado, env vars relevantes y runbook básico de "qué hacer si se rompe X". |
| [`docs/api-football-config.md`](docs/api-football-config.md) | Config del provider deportivo (plan Pro $19), IDs de liga (Mundial = 1), endpoints clave y procedimiento exacto para el switch al Mundial. |
| [`docs/pre-launch-checklist.md`](docs/pre-launch-checklist.md) | Lista canónica de lo pendiente antes y durante el Mundial: dominios, backups, monitoring, performance. Done items al final para referencia. |
| [`docs/incident-2026-05-18-data-wipe.md`](docs/incident-2026-05-18-data-wipe.md) | Post-mortem del wipe accidental de QA. Causas raíz, mitigaciones aplicadas y reglas operativas para no repetirlo. |
| [`docs/match-data-research.md`](docs/match-data-research.md) | Pre-análisis histórico de APIs candidatas para datos de partidos. Decisión: api-football. Plan de failover. |
| [`docs/pre-launch-testing.md`](docs/pre-launch-testing.md) | Estrategia de validación del flow end-to-end (predicciones + scoring + leaderboard) antes del kickoff del 11 de junio 2026. |

### Referencias visuales

| Archivo                                                                        | Qué encontrarás                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| [`docs/leaderboard-reference.html`](docs/leaderboard-reference.html)           | Referencia visual oficial del ranking en vivo. Source of truth del diseño. |
| [`docs/achievements-reference.html`](docs/achievements-reference.html)         | Referencia visual del catálogo de logros (cards, tiers, share chips, sprite SVG inline). |
| [`docs/public-profile-reference.html`](docs/public-profile-reference.html)     | Referencia visual del perfil público.                                    |

### Spec-driven development

| Archivo                                                | Qué encontrarás                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [`openspec/AGENTS.md`](openspec/AGENTS.md)             | Workflow OpenSpec: cómo se abre una propuesta, qué archivos lleva, cuándo se archiva.                            |
| [`openspec/project.md`](openspec/project.md)           | Contexto del proyecto orientado a agentes IA. Justificaciones de stack, convenciones internas.                   |
| [`openspec/changes/`](openspec/changes/)               | Propuestas en curso o archivadas. Cada subdirectorio es una capability con su `proposal.md`, `tasks.md` y opcionalmente `design.md`. |

---

## Desarrollo local

Resumen rápido (lectura completa en [`docs/quickstart.md`](docs/quickstart.md)):

```bash
cp .env.example .env       # rellenar AUTH_SECRET + GOOGLE_CLIENT_*
npm install
docker compose up -d
npm run db:push
npm run fixtures           # logros + seed de partidos con fechas adelantadas
npm run dev                # http://localhost:3000
```

### Comandos útiles

| Comando                   | Qué hace                                                  |
| ------------------------- | --------------------------------------------------------- |
| `npm run dev`             | Next.js en `http://localhost:3000`                        |
| `npm run fixtures`        | Logros + seed de partidos con shift de fechas (idempotente) |
| `npm run typecheck`       | `tsc --noEmit`                                            |
| `npm test`                | Vitest (unit + component)                                 |
| `npm run e2e`             | Playwright (golden paths sobre páginas públicas)          |
| `npm run check`           | Biome lint + format                                       |
| `npm run db:generate`     | Genera una migración nueva desde el schema                |
| `npm run db:migrate`      | Aplica las migraciones pendientes                         |
| `npm run db:push`         | Empuja el schema actual sin migración (solo dev local)    |
| `npm run db:studio`       | UI web de Drizzle (`https://local.drizzle.studio`)        |

## Licencia

Por definir.
