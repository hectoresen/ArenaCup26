# Design — add-data-model

## Identidades

- `users`, `matches`, `predictions`, `point_events`, `teams` usan **UUID v4** (`uuid().defaultRandom()`).
- `achievement_definitions.id` es **text (slug)** porque proviene del catálogo en `docs/achievements.md` y resulta más legible en queries (`first-hit`, `top-10`, `the-goat`).

## Enums

Se declaran enums Postgres (`pgEnum`) para los campos de dominio cerrado:

| Enum                 | Valores                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `match_status`       | `scheduled-tbd`, `scheduled`, `prediction-locked`, `live`, `finished`, `postponed`, `cancelled` |
| `match_stage`        | `group`, `round-of-16`, `quarter`, `semi`, `final`, `third-place`                             |
| `prediction_kind`    | `simple`, `exact`, `double-1x`, `double-x2`, `double-12`                                      |
| `prediction_winner`  | `home`, `away`, `draw`                                                                        |
| `achievement_tier`   | `common`, `rare`, `epic`, `legendary`, `mythic`, `goat`                                       |
| `point_event_kind`   | `simple`, `exact`, `double`, `combo`, `poll`, `referral`                                      |

Los enums son rígidos. Cualquier valor nuevo requiere migración `ALTER TYPE ADD VALUE`.

## Compatibilidad con Auth.js v5

El adapter de Drizzle de Auth.js exige las tablas `users`, `accounts`, `sessions`, `verification_tokens` con columnas concretas. Las extendemos con campos propios del dominio:

- `users.country` (varchar 3, opcional, ISO 3166-1 alpha-2/3 + 1 char buffer).
- `users.username` (varchar 20, único, no nulo).
- `users.last_active_at` (timestamp con tz, nullable inicialmente; se rellena al primer evento).

## Cascadas y RGPD

Hard delete del usuario propaga a sus datos derivados:

- `accounts`, `sessions`, `predictions`, `point_events`, `user_achievements`, `username_history` → `ON DELETE CASCADE`.
- `point_events.match_id` → `ON DELETE SET NULL` (no se pierde el log si un partido raro se elimina; aun así no debería ocurrir en producción).

## Constraint único de predicción

`(user_id, match_id)` único en `predictions` — un usuario solo tiene UNA predicción por partido. Las ediciones sobreescriben la fila existente.

## Penaltis y prórroga

Para implementar las reglas de eliminatoria de `docs/business-rules.md`:

- `matches.home_score` / `matches.away_score` capturan el resultado al final del 90'.
- `matches.home_score_extra` / `matches.away_score_extra` capturan el resultado al final de la prórroga (sin penaltis), cuando aplique.
- `matches.penalty_winner_team_id` (FK a `teams`) se rellena solo si fue a tanda.

El "marcador exacto" para scoring usa `*_extra` cuando hay prórroga; en caso contrario, los `*_score`.

## `username_history`

Tabla auxiliar para preservar usernames antiguos:

- PK compuesta `(user_id, old_username)`.
- Índice **único** sobre `old_username` solo, para impedir que cualquier otro usuario reuse uno liberado.

## Tipos de predicción y validación

`prediction_kind` define el shape válido de los demás campos. La validación a nivel aplicación (Zod) garantiza:

| `kind`         | `predicted_winner` | `predicted_home_score` | `predicted_away_score` |
| -------------- | :----------------: | :--------------------: | :--------------------: |
| `simple`       | obligatorio        | `NULL`                 | `NULL`                 |
| `exact`        | `NULL`             | obligatorio            | obligatorio            |
| `double-1x`    | `NULL`             | `NULL`                 | `NULL`                 |
| `double-x2`    | `NULL`             | `NULL`                 | `NULL`                 |
| `double-12`    | `NULL`             | `NULL`                 | `NULL`                 |

La BD solo impone tipos y nullability básicos; la validación de coherencia vive en el código de aplicación (en una propuesta posterior, `add-prediction-flow`).

## Trade-offs considerados

- **Booleanos vs `int 0/1`**: usamos `boolean` nativo Postgres (`is_shareable`).
- **Soft delete**: descartado. La regla cerrada es hard delete.
- **`predictions.locked_at`**: nullable hasta el kick-off, donde el sistema lo establece para "congelar" la predicción.
- **`achievement_definitions` en BD vs en código**: en BD para permitir queries cruzadas con `user_achievements` y tener el catálogo seedable. El catálogo se siembra desde `docs/achievements.md` en una propuesta posterior.
- **Soft delete de partidos**: no procede; los partidos no se borran, solo cambian de `status` (`postponed`, `cancelled`).
