# add-data-model

## Why

Materializar el modelo de datos preliminar que vive en `docs/architecture.md` como un esquema Drizzle versionable y migrable. Sin esto, ninguna otra capability (auth, leaderboard, prediction-flow, scoring-engine, achievements, public-profile, match-data) puede arrancar.

Esta es la primera propuesta OpenSpec del proyecto y, deliberadamente, **solo contiene infraestructura de datos**: nada de lógica de negocio, nada de UI, nada de endpoints. Sirve además como baseline para validar que el flujo OpenSpec funciona en este repositorio.

## What changes

Capability nueva: **`data-model`**.

- Definir todas las tablas de la BD: `users`, `accounts`, `sessions`, `verification_tokens`, `username_history`, `teams`, `matches`, `predictions`, `user_points`, `point_events`, `achievement_definitions`, `user_achievements`.
- Declarar enums Postgres para los campos de dominio cerrado: `match_status`, `match_stage`, `prediction_kind`, `prediction_winner`, `achievement_tier`, `point_event_kind`.
- Configurar Drizzle ORM y drizzle-kit (`drizzle.config.ts`).
- Validación de variables de entorno con Zod (`src/lib/env.ts`).
- Cliente Drizzle único (`src/server/db/client.ts`).
- Generar la migración SQL inicial vía `drizzle-kit generate`.

**No incluye**:

- Seed de datos (logros, equipos, fixture) — pertenecen a `add-achievements`, `add-match-data-providers`.
- Lógica de scoring, validaciones de negocio o endpoints.
- Cualquier UI o ruta de la app.
- Configuración de Auth.js completa con callbacks (queda para `add-auth-google`).

## Impact

- **Bloquea**: ninguna capability — esta es el primer eslabón.
- **Desbloquea**: `auth`, `match-data`, `prediction-flow`, `scoring-engine`, `leaderboard`, `achievements`, `public-profile`.
- **Riesgos**:
  - Cambios futuros al schema requerirán migraciones aditivas. Cualquier modificación posterior pasa por su propia propuesta `update-data-model-<motivo>`.
  - Los enums son rígidos por definición Postgres. Añadir valores nuevos requiere migración `ALTER TYPE`.
- **Decisiones cerradas que esta propuesta materializa**: ver `docs/business-rules.md`, `docs/scoring.md`, `docs/achievements.md`, `docs/public-profile.md`. Esta propuesta no introduce reglas nuevas.
