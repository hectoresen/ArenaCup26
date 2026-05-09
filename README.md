# WebMundial 26

Plataforma social y competitiva alrededor del Mundial de Fútbol 2026, centrada en un **ranking en tiempo real** de usuarios que predicen partidos, completan desafíos y suman puntos.

> Estado: **fase de entendimiento**. Sin código todavía. Las especificaciones se generan vía OpenSpec en `openspec/changes/`.

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

## Roadmap a corto plazo

Fase actual: **entendimiento**. Próximas iteraciones:

- [x] Fijar tabla de puntuación oficial en `docs/scoring.md` (cerrada 2026-05-05).
- [x] Cerrar scope de notificaciones y auth para fase 1.
- [x] Cerrar catálogo de `achievements` en `docs/achievements.md` y alcance de perfil público en `docs/public-profile.md`.
- [ ] **Crítico**: cerrar fuente de `match-data` (ver `docs/match-data-research.md`).
- [ ] Primer cambio OpenSpec: `add-auth-google` (login + sesión).
- [ ] Segundo cambio: `add-match-data-providers` (adapters con dos APIs redundantes).
- [ ] Tercer cambio: `add-leaderboard-realtime` (SSE + ranking inicial).
- [ ] Cuarto cambio: `add-prediction-flow` (UI de predicción + persistencia, incluye doble).
- [ ] Quinto cambio: `add-scoring-engine` (motor con cálculo provisional en vivo).
- [ ] Sexto cambio: `add-notifications-inapp` (toasts, feed, badge campana).
- [ ] Séptimo cambio: `add-public-profile` (página `/u/<username>`).
- [ ] Octavo cambio: `add-achievements` (catálogo, evaluación, unlocks).

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
