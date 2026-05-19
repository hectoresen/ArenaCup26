# Purpose

Definir el modelo de datos relacional que sostiene todas las capabilities de ArenaCup26: identidad de usuarios, autenticación, partidos del Mundial, predicciones, puntos, logros y perfil público.

# Requirements

## Requirement 1: Tabla de usuarios

El sistema mantiene una tabla `users` con identidad pública mínima del usuario.

### Scenario: Crear usuario al primer login con Google

- **Given** un usuario hace login con Google por primera vez
- **When** el adapter de Auth.js inserta el registro
- **Then** se crea una fila en `users` con `id`, `email`, `name`, `image` y `created_at`. El campo `username` debe ser elegido en el onboarding antes de poder navegar a rutas privadas.

### Scenario: Username único

- **Given** existe un usuario con `username = pepe123`
- **When** otro usuario intenta crear su cuenta con el mismo username
- **Then** la inserción falla por la restricción única.

### Scenario: Last active actualizado

- **Given** un usuario realiza una acción significativa (login, predicción, edición)
- **When** se procesa la acción
- **Then** `users.last_active_at` se actualiza al `now()`.

## Requirement 2: Histórico de usernames

El sistema preserva los usernames antiguos para evitar que sean reusados por otros usuarios tras un cambio.

### Scenario: Cambio de username reserva el viejo

- **Given** un usuario con `username = pepe123` ejerce su cambio único a `pepe`
- **When** se confirma el cambio
- **Then** se inserta una fila en `username_history (user_id, 'pepe123', released_at)` y cualquier intento posterior de otro usuario de registrarse con `pepe123` falla por el índice único de `username_history.old_username`.

## Requirement 3: Partidos con estado y fase

`matches.status` toma uno de 7 valores que reflejan el ciclo de vida del partido (ver `docs/business-rules.md`). `matches.stage` distingue grupos de eliminatorias.

### Scenario: Inserción inicial de un partido sin equipos definidos

- **Given** se siembra el fixture del Mundial al inicio del torneo
- **When** se inserta una semifinal sin equipos confirmados
- **Then** la fila tiene `home_team_id = NULL`, `away_team_id = NULL`, `status = 'scheduled-tbd'`.

### Scenario: Partido pospuesto mantiene predicciones

- **Given** un partido `scheduled` con predicciones de varios usuarios
- **When** la API marca el partido como `postponed` y actualiza `kickoff_at`
- **Then** las predicciones siguen vinculadas al `match_id` y son editables hasta el nuevo kick-off.

### Scenario: Partido cancelado anula predicciones para scoring

- **Given** un partido `scheduled` con predicciones
- **When** el partido pasa a `cancelled`
- **Then** las predicciones permanecen en BD pero el scoring engine no genera `point_events` para ellas; las rachas no se rompen (la racha "salta" el partido).

## Requirement 4: Una predicción por usuario y partido

`predictions` impone unicidad sobre `(user_id, match_id)`.

### Scenario: Editar predicción sobreescribe

- **Given** un usuario ya envió una predicción para un partido
- **When** envía otra predicción para el mismo partido antes del kick-off
- **Then** la fila existente se actualiza (no se inserta una nueva) y `submitted_at` refleja la última edición.

## Requirement 5: Tipos de predicción

`prediction_kind` distingue entre simple, exacto y las tres dobles (`1x`, `x2`, `12`). La coherencia entre `kind` y los demás campos se valida a nivel aplicación.

### Scenario: Predicción exacta requiere marcador

- **Given** una predicción con `kind = 'exact'`
- **When** se valida antes de insertar
- **Then** `predicted_home_score` y `predicted_away_score` deben ser no nulos y `predicted_winner` debe ser `NULL`.

### Scenario: Predicción simple requiere ganador

- **Given** una predicción con `kind = 'simple'`
- **When** se valida
- **Then** `predicted_winner` no nulo y los marcadores `NULL`.

### Scenario: Predicción doble no lleva ni ganador ni marcador

- **Given** una predicción con `kind` en `{ 'double-1x', 'double-x2', 'double-12' }`
- **When** se valida
- **Then** `predicted_winner`, `predicted_home_score` y `predicted_away_score` son todos `NULL`.

## Requirement 6: Resultados de partido con prórroga y penaltis

Para implementar las reglas de eliminatoria, `matches` distingue marcador de 90' del marcador de prórroga.

### Scenario: Partido de eliminatoria que va a penaltis

- **Given** un partido eliminatoria que termina 1-1 al 90', 1-1 tras prórroga, y se decide por penaltis 4-3 a favor del equipo local
- **When** se registra el resultado oficial
- **Then** `home_score = 1`, `away_score = 1`, `home_score_extra = 1`, `away_score_extra = 1`, `penalty_winner_team_id` apunta al equipo local. Para scoring, "marcador exacto" cuenta como `1-1` y "ganador" cuenta como local.

## Requirement 7: Puntos derivados

`user_points` mantiene agregados; `point_events` mantiene el log granular.

### Scenario: Cierre oficial genera evento

- **Given** un partido pasa a `finished`
- **When** el scoring engine confirma los puntos del usuario
- **Then** se crea una fila en `point_events` con `kind` adecuado y se actualizan `total_points`, `correct_count` y `streak` en `user_points`.

## Requirement 8: Catálogo de logros y desbloqueos

`achievement_definitions` siembra los 24 logros de `docs/achievements.md`; `user_achievements` registra unlocks por usuario.

### Scenario: Unlock idempotente

- **Given** un usuario ya tiene desbloqueado el logro `first-hit`
- **When** se intenta insertar otro unlock para el mismo `(user_id, achievement_id)`
- **Then** la inserción falla por la PK compuesta; el código de aplicación usa `ON CONFLICT DO NOTHING`.

## Requirement 9: Cascadas de eliminación de cuenta

Eliminar un usuario borra en cascada todos sus datos derivados (RGPD hard delete).

### Scenario: Hard delete completo

- **Given** un usuario solicita eliminar su cuenta
- **When** se ejecuta `DELETE FROM users WHERE id = $1`
- **Then** se borran en cascada `accounts`, `sessions`, `predictions`, `point_events`, `user_achievements`, `username_history`. El campo `point_events.match_id` permanece en cualquier fila no relacionada con el usuario.
