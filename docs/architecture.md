# Arquitectura — ArenaCup26

> Estado: borrador. Sujeta a revisión durante la fase de entendimiento.

## Vista de 10 000 metros

```
┌──────────────┐   HTTPS    ┌──────────────────────────────┐   SQL   ┌─────────────┐
│  Navegador   │ ─────────► │  Next.js 15 (Vercel)         │ ──────► │ Postgres    │
│  (RSC + JS)  │            │  · App Router (RSC)          │         │ (Neon)      │
│              │ ◄───SSE─── │  · API routes                │         │             │
└──────────────┘            │  · Auth.js v5                │         └─────────────┘
                            │  · Drizzle ORM               │
                            │  · Scoring engine            │
                            └──────────────────────────────┘
```

## Flujos principales

### 1. Login

`Cliente` → `/api/auth/[...]` (Auth.js) → Google OAuth → callback → cookie de sesión → redirige al dashboard.

### 2. Predicción

`Cliente (form)` → server action → valida con Zod → inserta `prediction` (Drizzle) → confirma al cliente.

### 3. Eventos en vivo durante un partido

`Match poller` (server) consulta cada N s las APIs primaria/secundaria de `match-data` → al detectar un cambio (gol, autogol, prórroga, penaltis) → emite evento interno → **scoring engine en modo provisional** recalcula los puntos de las predicciones afectadas con el marcador actual → `leaderboard` SSE empuja diff a clientes conectados.

Resultado para el usuario:
- En su **dashboard**: "tu predicción del Brasil–Argentina suma +30 puntos provisionales si acaba así".
- En el **leaderboard**: posiciones se mueven en tiempo real conforme se desarrollan los partidos.

### 4. Resolución de partido (cierre)

Cuando el partido pasa a estado `FINISHED` (vía API o admin manual) → resultado oficial confirmado → scoring engine **promueve** los puntos provisionales a oficiales → actualiza `user_points`, racha y `point_events`. Si el partido es **pospuesto/cancelado**, los provisionales se descartan.

### 5. Ranking en vivo

`Cliente` abre `GET /api/leaderboard/stream` (SSE) → server emite snapshot inicial + diffs cuando cambian los puntos (sean provisionales o confirmados) → cliente actualiza el DOM (la UI se inspira en `leaderboard-reference.html`). Las filas pueden indicar visualmente cuándo los puntos son provisionales.

## Capabilities (futuras carpetas en `openspec/specs/`)

- `auth` — login con Google OAuth, sesión y logout. Registro manual con `credentials` diferido a fase 2.
- `leaderboard` — ranking global + endpoint SSE.
- `prediction-flow` — UI y persistencia de predicciones (incluye doble predicción 1X / X2 / 12).
- `scoring-engine` — cálculo de puntos al cerrar un partido.
- `dashboard` — panel privado por usuario (próximos partidos, mis predicciones, mis puntos).
- `notifications` — bell dropdown in-app + Web Push opt-in. 13 kinds:
  `prediction_sent`, `prediction_locked`, `match_finished`,
  `achievement_unlocked`, `system`, `friend_request`, `friend_accepted`,
  y 6 de grupos (`group_invited`, `group_joined`, `group_left`,
  `group_expelled`, `group_admin_transferred`, `group_deleted`).
  Push activo solo para kinds time-sensitive (invites, expulsiones,
  recordatorios de kickoff). VAPID keys en Railway.
- `achievements` — catálogo de **25 logros en 6 tiers** (común, poco común, épico, legendario, mítico, GOAT). Evaluación al cierre oficial de partido (no con provisionales) + gate `ACHIEVEMENTS_MIN_FINISHED_MATCHES` para los de rendimiento. `team-spirit` (común) está en `GATE_BYPASS` — se desbloquea al instante sin esperar al gate. Catálogo formal en `docs/achievements.md`.
- `public-profile` — página `/u/<username>` con identidad, stats básicas, bandera opcional y catálogo completo de logros. Accesible sin login. Ver `docs/public-profile.md`.
- `groups` — **grupos de competición** (`add-competition-groups`, 2026-05-19). Ranking privado entre amigos como **filtro+reorder sobre `user_points` global** (cero divergencia de scoring). Caps: 3 grupos/user, 5–100 miembros/grupo, 5 links/grupo. Ver `docs/groups.md`.
- `social` — hub en `/social`: amigos, invitaciones (a app + a grupos), grupos. Reúne todas las relaciones del usuario en una sola ruta. La vieja ruta `/amigos` redirige a `/social`.
- `match-data` — fuente de fixture, resultados y **eventos en vivo** (goles, prórrogas, penaltis). Diseñada con **redundancia de dos APIs en paralelo** (failover). Plan Pro de api-football $19/mes en producción.

## Modelo de datos preliminar

Esquema tentativo (Drizzle), por refinar en cada propuesta:

- `users` — id, email, name, image, country (opcional), username (único), last_active_at, created_at.
- `accounts` / `sessions` — tablas estándar de Auth.js.
- `username_history` — user_id (FK), old_username (único), released_at. Reserva permanente del viejo username tras un cambio.
- `teams` — id, code, name, flag.
- `matches` — id, stage (`group|round-of-16|quarter|semi|final|third-place`), home_team_id (NULL si TBD), away_team_id (NULL si TBD), kickoff_at, status (`scheduled-tbd|scheduled|prediction-locked|live|finished|postponed|cancelled`), home_score, away_score, home_score_extra (eliminatoria), away_score_extra, penalty_winner_team_id, updated_at.
- `predictions` — id, user_id, match_id, kind (`simple|exact|double-1x|double-x2|double-12`), predicted_winner (`home|away|draw`, NULL si exact), predicted_home_score (NULL si simple/double), predicted_away_score (NULL si simple/double), submitted_at, locked_at.
- `user_points` — user_id (PK), total_points, correct_count, streak.
- `point_events` — id, user_id, match_id, kind (`exact`, `simple`, `double`, `combo`, `poll`, `referral`), points, created_at.
- `achievement_definitions` / `user_achievements` — ver `docs/achievements.md`.

Las relaciones detalladas se cierran en la propuesta `add-data-model`.
