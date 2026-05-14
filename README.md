# WebMundial 26

Plataforma social y competitiva alrededor del Mundial de Fútbol 2026, centrada en un **ranking en tiempo real** de usuarios que predicen partidos, completan desafíos y suman puntos.

> Estado: **construcción activa**. Panel `/inicio`, auth con Google, modelo de datos, scoring engine, pipeline de partidos y catálogo de logros operativos. Próximas piezas en `openspec/changes/`.
>
> **Empezar a hacer rodar el proyecto en local → [`docs/quickstart.md`](docs/quickstart.md).**
> **Desplegar en producción (Railway) → [`docs/deployment.md`](docs/deployment.md).**
> **Decisiones técnicas vigentes → [`docs/decisions.md`](docs/decisions.md).**

## Visión

En lugar de mostrar resultados estáticos, WebMundial 26 construye una experiencia viva alrededor de la actividad de los usuarios:

- **Predicciones** sobre los partidos del Mundial 26 (Canadá · México · USA).
- **Ranking en vivo** con Server-Sent Events — sin recargas.
- **Sistema de puntos** que premia aciertos, combos, encuestas e invitaciones.
- **Onboarding ligero** con Google OAuth (con fallback a registro manual).
- **Panel privado** por usuario: predicciones, puntos, proyecciones.
- **Tabla global** visible para todo el mundo.

La inspiración visual del leaderboard está en [`docs/leaderboard-reference.html`](docs/leaderboard-reference.html).

## Stack

| Capa             | Tecnología                                              |
| ---------------- | ------------------------------------------------------- |
| Frontend         | Next.js 15 (App Router) · React 19 · TypeScript         |
| Estilos          | Tailwind CSS v4                                         |
| Realtime         | Server-Sent Events (SSE)                                |
| Datos            | PostgreSQL (Neon) · Drizzle ORM                         |
| Auth             | Auth.js v5 (Google OAuth en fase 1; credenciales diferido a fase 2) |
| Validación       | Zod                                                     |
| Testing          | Vitest (unit) · Playwright (E2E)                        |
| Gestión paquetes | pnpm                                                    |
| Despliegue       | Vercel + Neon                                           |

Justificaciones y trade-offs en [`openspec/project.md`](openspec/project.md).

## Estructura del repositorio

```
.
├── README.md                  # este archivo
├── AGENTS.md                  # convenciones para agentes IA (genérico)
├── CLAUDE.md                  # deltas específicos de Claude Code
├── .gitignore .editorconfig .env.example
├── .claude/
│   └── skills/                # skills de proyecto (spec-author, scoring-rules, leaderboard-ui)
├── docs/                      # documentación humana
│   ├── README.md              # índice
│   ├── architecture.md        # arquitectura objetivo
│   ├── scoring.md             # tabla de puntuación
│   ├── glossary.md            # glosario del dominio
│   └── leaderboard-reference.html
└── openspec/                  # spec-driven development
    ├── project.md             # contexto del proyecto para IA
    ├── AGENTS.md              # workflow OpenSpec
    ├── specs/                 # capacidades desplegadas (vacío al inicio)
    └── changes/               # propuestas de cambio (kebab-case)
        └── archive/
```

## Cómo trabajar en este proyecto

1. **Lee primero** `AGENTS.md` y `openspec/project.md` para alinearte con el contexto.
2. **Antes de escribir código**, abre una propuesta en `openspec/changes/<nombre-del-cambio>/`.
3. La propuesta incluye `proposal.md`, `tasks.md` y, opcionalmente, `design.md` y los specs del estado futuro.
4. Una vez aprobada, se implementa siguiendo el `tasks.md` y se archiva en `openspec/changes/archive/YYYY-MM-DD-<nombre>/`.

## Roadmap

Snapshot 2026-05-14. Detalle de cada propuesta en `openspec/changes/<nombre>/`.

### Capabilities cerradas (ver `docs/decisions.md` para detalle)

- ✅ `add-data-model` — schema Drizzle de 14 tablas con enums Postgres.
- ✅ `add-scoring-engine` — motor de puntuación puro + edge cases.
- ✅ `add-achievements-seed` — catálogo de 24 logros.
- ✅ `add-fixture-seed-wc2022` — 32 equipos + 24 partidos.
- ✅ `add-i18n` — es/en/fr/ar con RTL.
- ✅ `add-auth-google` — login con Google + Auth.js v5.
- ✅ `add-leaderboard-public` — landing pública con podio + ranking.
- ✅ `add-faq` — preguntas frecuentes con `<details>` nativos.
- ✅ `add-error-pages` — 404 + runtime error con CTA.
- ✅ `add-account-menu` — dropdown con trigger customizable.
- ✅ `add-testing-tooling` — Vitest + RTL + helpers.
- ✅ `add-match-data-providers` — ApiFootballProvider + adapter (round a).
- ✅ `add-match-data-pipeline` — cron + reconciler + endpoint protegido.
- ✅ `add-app-shell` — nav fijo + bottom-nav + avatar para área logada.
- ✅ `add-home-dashboard` — `/inicio` con hero, live/next, próximos, progreso, mini-leaderboard.
- ✅ `add-public-profile-page` — `/u/<username>` con auto-gen de username.

### Pendientes (no bloquean, en orden razonable)

- `add-prediction-flow` — submit/edit de predicción desde el detalle del partido.
- `add-fixture-seed-wc2026` — equipos + entries de `team_external_ids` para los 48 del Mundial 2026.
- `add-matches-page` — listado y detalle (los CTA del nav y de las cards apuntan ya aquí).
- `add-onboarding` — pantalla para editar username + país tras el primer login.
- `add-leaderboard-sse` — refresco en tiempo real del panel y ranking.
- `add-scoring-pipeline` — recálculo de puntos cuando un match cambia.
- `add-ranking-history` — snapshot semanal para sparkline + delta.
- `add-live-scoring` — goles parciales del provider durante el live.
- `add-match-data-providers-livescore` — failover con Live-Score-API.
- `add-notifications`, `add-achievements-page`, `add-rate-limiting`, `add-security-headers`, `add-ci-pipeline`.

Estrategia de validación pre-Mundial en [`docs/pre-launch-testing.md`](docs/pre-launch-testing.md).

## Desarrollo local

Guía paso-a-paso completa con OAuth, troubleshooting y trucos para datos reales:
**[`docs/quickstart.md`](docs/quickstart.md)**.

TL;DR:

```bash
cp .env.example .env       # rellenar AUTH_SECRET + GOOGLE_CLIENT_*
npm install
docker compose up -d
npm run db:push
npm run fixtures           # logros + WC22 con fechas adelantadas
npm run dev                # http://localhost:3000
```

### Comandos útiles

| Comando                   | Qué hace                                                  |
| ------------------------- | --------------------------------------------------------- |
| `npm run dev`             | Next.js en `http://localhost:3000`                        |
| `npm run fixtures`        | Logros + WC22 + shift de fechas (idempotente)             |
| `npm run typecheck`       | `tsc --noEmit`                                            |
| `npm test`                | Vitest                                                    |
| `npm run check`           | Biome lint + format                                       |
| `npm run db:push`         | Aplica el schema actual sin migraciones versionadas       |
| `npm run db:studio`       | UI web de Drizzle (`https://local.drizzle.studio`)        |
| `docker compose down`     | Parar Postgres (los datos se conservan)                   |
| `docker compose down -v`  | Parar + **borrar** el volumen de datos                    |

## Licencia

Por definir.
