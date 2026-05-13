# WebMundial 26

Plataforma social y competitiva alrededor del Mundial de Fútbol 2026, centrada en un **ranking en tiempo real** de usuarios que predicen partidos, completan desafíos y suman puntos.

> Estado: **construcción activa**. Panel `/inicio`, auth con Google, modelo de datos, scoring engine, pipeline de partidos y catálogo de logros operativos. Próximas piezas en `openspec/changes/`.
>
> **Empezar a hacer rodar el proyecto en local → [`docs/quickstart.md`](docs/quickstart.md).**
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

Snapshot 2026-05-10. Detalle de cada propuesta en `openspec/changes/<nombre>/`.

### Cerradas (mergeadas en main)

- ✅ `add-data-model` — schema Drizzle + migración inicial.
- ✅ `add-leaderboard-public` — home `/` con snapshot del top 10.
- ✅ `add-join-cta` — CTA "Predecir ahora" + modal stub.
- ✅ `add-auth-google` — Google OAuth real vía Auth.js v5 + Drizzle adapter.
- ✅ `add-account-menu` — hamburguesa con avatar al estar logueado, "Cerrar sesión".
- ✅ `add-i18n` — es/en/fr/ar con RTL, switcher en top-start.
- ✅ `add-error-pages` — 404 + error.tsx + global-error.tsx i18n-aware.
- ✅ `add-faq` — `/faq` con tabla de scoring + 9 Q&A.
- ✅ `add-testing-tooling` — RTL + jsdom + helper de providers + sample tests.

### Bloqueadas por **diseño / mockup**

- ⏸ `add-prediction-flow` — UI selector simple/exacto/doble.
- ⏸ `add-public-profile` — página `/u/<username>`.
- ⏸ `add-achievements` — vistas privada y pública del catálogo.
- ⏸ `add-auth-onboarding` — form username + país tras primer login.
- ⏸ `add-dashboard` — área privada principal.

### Bloqueadas por **integración API**

- ⏸ `add-match-data-providers` — adapters de API-Football + Live-Score-API (necesita claves reales para validar end-to-end).
- ⏸ `add-leaderboard-sse` — push en vivo del ranking (depende de match-data).
- ⏸ `add-notifications-inapp` — depende de eventos del scoring engine y match-data.

### **Disponibles ya** (no dependen de diseño ni de claves API)

- 🟢 `add-scoring-engine` — función pura del motor de puntuación. Tests con fixtures.
- 🟢 `add-edge-case-fixtures` — 8 escenarios sintéticos (prórroga, penaltis, pospuesto, cancelado, etc.) con tests del scoring engine.
- 🟢 `add-fixture-seed-wc2022` — dataset histórico del Mundial 2022 para replay end-to-end.
- 🟢 `add-achievements-seed` — script que siembra los 24 logros del catálogo.
- 🟢 `add-rate-limiting` — middleware simple (token bucket) sobre `/api/auth/*` y futuras APIs.
- 🟢 `add-security-headers` — CSP, HSTS, etc. vía middleware o `next.config`.
- 🟢 `add-ci-pipeline` — GitHub Actions con `npm test`, `npm run typecheck`, `npm run check`.
- 🟢 Más tests de componentes existentes (`<JoinCta />`, `<AccountMenu />`, `<LanguageSwitcher />`, `<ErrorScreen />`, `<ScoringTable />`).

Estrategia de validación pre-Mundial en [`docs/pre-launch-testing.md`](docs/pre-launch-testing.md).

## Desarrollo local

Requisitos: **Node 22+**, **pnpm 9+** y **Docker** (o un Postgres 16 propio en `localhost:5432`).

```bash
# 1. Variables de entorno
cp .env.example .env
# Rellena AUTH_SECRET (`openssl rand -base64 48`), GOOGLE_CLIENT_ID y
# GOOGLE_CLIENT_SECRET (Google Cloud Console → OAuth 2.0 Client).

# 2. Instalar dependencias
pnpm install

# 3. Levantar Postgres con Docker Compose
docker compose up -d
# Usuario / pass / base: wmundial / wmundial / wmundial — coinciden con
# el DATABASE_URL del .env.example.

# 4. Generar y aplicar la migración inicial
pnpm db:generate
pnpm db:migrate

# 5. Configurar OAuth en Google Cloud Console
# Credentials → tu OAuth 2.0 Client ID → Authorized redirect URIs:
#   http://localhost:3000/api/auth/callback/google

# 6. Arrancar Next.js
pnpm dev
# → http://localhost:3000
```

### Comandos útiles

| Comando                   | Qué hace                                            |
| ------------------------- | --------------------------------------------------- |
| `pnpm dev`                | Next.js en `http://localhost:3000`                  |
| `pnpm typecheck`          | `tsc --noEmit`                                      |
| `pnpm test`               | Vitest (unit)                                       |
| `pnpm e2e`                | Playwright (E2E)                                    |
| `pnpm check`              | Biome formato + lint                                |
| `pnpm db:studio`          | UI web de Drizzle para inspeccionar la BD           |
| `docker compose down`     | Parar Postgres (los datos se conservan)             |
| `docker compose down -v`  | Parar + **borrar** el volumen de datos              |

## Licencia

Por definir.
