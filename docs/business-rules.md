# Reglas de negocio

> Estado: cerradas (2026-05-07). Cualquier ajuste futuro pasa por una propuesta `update-business-rules-<motivo>`.

Reglas operativas que **no** son del sistema de puntuación (ver `scoring.md`) pero que afectan a la lógica de la aplicación.

## Estados de un partido

| Estado                | Descripción                                                                       | Predicible                       | Visible             |
| --------------------- | --------------------------------------------------------------------------------- | -------------------------------- | ------------------- |
| `scheduled-tbd`       | Partido futuro con uno o ambos equipos por determinar (semis, final pre-bracket). | No                               | Sí, en gris         |
| `scheduled`           | Partido futuro con equipos confirmados.                                           | Sí                               | Sí                  |
| `prediction-locked`   | Kick-off pasado, partido aún no empezado oficialmente.                            | No                               | Sí                  |
| `live`                | Partido en curso.                                                                 | No                               | Sí, con marcador    |
| `finished`            | Partido cerrado oficialmente.                                                     | No                               | Sí, con marcador    |
| `postponed`           | Partido pospuesto a nueva fecha.                                                  | Sí, hasta nuevo kick-off         | Sí, badge "pospuesto" |
| `cancelled`           | Partido cancelado definitivamente.                                                | No                               | Sí, en gris         |

## Ventana de predicción

- Las predicciones se aceptan **desde que el partido existe en el sistema** (fixture cargado al inicio del Mundial).
- Se cierran al **kick-off oficial** (ver `scoring.md`, sección Anti-trampa).
- Cualquier edición es válida hasta el kick-off, sin límite de número de cambios.

## Partidos con equipos TBD

- Se renderizan en el fixture en **greyscale** desde el inicio, mostrando el bracket completo.
- No son predecibles hasta que ambos equipos quedan confirmados.
- Al confirmarse los equipos, el estado pasa a `scheduled` automáticamente y se desbloquea la predicción.

## Partidos pospuestos

- La predicción existente **se mantiene** y queda **editable** hasta el nuevo kick-off.
- El usuario puede ajustarla con la nueva información o dejarla tal cual.
- La UI muestra el badge "pospuesto" con la nueva fecha cuando se conoce.

## Partidos cancelados

- La predicción existente queda **anulada**, puntos = 0.
- La racha del usuario **"salta" el partido cancelado**: si traía racha de 5 antes y acierta el siguiente partido válido, sigue en racha 6.
- No se crea registro en `point_events` para el cancelado.

## Reglas específicas de partidos de eliminatoria

Las eliminatorias del Mundial pueden ir a **prórroga (120')** y **tanda de penaltis**. Estas reglas se suman a las generales:

- **Marcador exacto**: cuenta el resultado al **final de la prórroga (120')**, sin incluir los penaltis. Ej. `Argentina 3-3 Francia (Argentina gana 4-2 por penaltis)` → marcador del partido = `3-3`.
- **Ganador (predicción simple)**: el **ganador oficial**, decidido por penaltis si los hubo. En el ejemplo, gana Argentina.
- **El "empate" NO es predicción simple válida** en eliminatoria — siempre hay un ganador oficial.
- **Dobles `1X` y `X2` NO aplican** en eliminatoria — no existe el empate como resultado oficial.
- **La doble `12`** sigue siendo lógicamente válida pero es **trivial** (siempre acierta), por lo que se **desactiva en la UI** en eliminatoria.
- **Conclusión UX**: en eliminatoria solo está disponible la **predicción simple** (con marcador exacto opcional). El selector de doble se oculta.

## Username

### Formato

- **3 a 20 caracteres**.
- Caracteres permitidos: `[a-z0-9_]` (sin acentos, sin espacios, sin mayúsculas, sin guiones ni puntos).
- El input acepta mayúsculas pero se almacena **normalizado a lowercase**.

### Rutas reservadas (no pueden ser username)

```
api, admin, u, auth, account, settings, login, logout, register,
leaderboard, ranking, achievements, predictions, matches, fixture,
profile, terms, privacy, help, about, root, www, support
```

### Cambio de username

- Permitido **una sola vez** en toda la vida de la cuenta.
- Una vez ejercido el cambio, queda fijo.
- El username viejo queda **reservado al usuario que lo tuvo**: nadie más puede registrarlo.
- Se persiste en una tabla `username_history (user_id, old_username, released_at)` con índice único en `old_username`.

## Eliminar cuenta

- **Hard delete completo**: el usuario y sus predicciones, racha, `point_events`, `user_achievements` y `username_history` se eliminan de la BD.
- El leaderboard se recalcula automáticamente sin él.
- Su perfil público (`/u/<username>`) devuelve 404.
- Si el Mundial ya terminó, los **registros congelados** (ej. quién fue el GOAT histórico) se mantienen, pero el nombre del usuario eliminado se sustituye por "Usuario eliminado" en cualquier vista pública.
- Cumple RGPD sin ambigüedad (derecho al olvido satisfecho).

## Grupos de competición

> Feature `add-competition-groups` shipped 2026-05-19. Doc detallado
> en [`groups.md`](groups.md). Esta sección recoge solo las reglas
> de negocio "duras" — el dominio no permite negociarlas.

### Caps

- **3 grupos activos por user** (admin + member juntos).
- **5–100 miembros por grupo**, default 25 (configurable por admin).
- **5 links de invitación activos por grupo**.

### Roles

- **Siempre exactamente 1 admin por grupo**. Transferible vía
  `transferAdmin`. El admin puede invitar, expulsar, generar/revocar
  links, editar y borrar.
- **Admin no puede abandonar** (`is_admin_cannot_leave`). Debe
  transferir el admin o borrar el grupo.

### Leave / Expel: siempre congela

Tanto `leaveGroup` como `expelMember` aplican la misma transición:
`left_at = now()` + snapshot de `user_points` actuales a `frozen_*`.
La fila NO se borra.

- El ex-miembro queda visible en el ranking del grupo con sus puntos
  al momento de irse y badge "Ha salido" junto al nombre.
- Si vuelve a ser invitado y acepta (o entra de nuevo a un grupo
  público al que ya había pertenecido), la misma fila se reactiva
  (`left_at = NULL`, `frozen_* = NULL`) y conserva todo su
  historial.

### Privacidad de grupos privados

- Los grupos `private` SÍ aparecen en `/social/grupos/descubrir` con
  candado. Click → popup "Solo por invitación". Da vida al buscador
  sin filtrar miembros ni ranking.
- Acceso directo por URL al detalle (`/social/grupos/<id>`) donde no
  eres miembro → 404 (no 403 — no filtramos la existencia del grupo).

### Borrado

- Soft-delete (`deleted_at`). Las memberships persisten para que el
  ranking congelado mantenga su referencia. El grupo desaparece de
  todos los listados y queries activas.

### Scoring

- **Idéntico al global**. El ranking del grupo es un filtro+reorder
  sobre el mismo `user_points`. Cero rama paralela, cero divergencia
  posible entre global y grupos.

### Reducir `max_members` por debajo del count actual

- **Bloqueado** (`max_members_below_count`). No permitimos
  auto-expulsiones implícitas por bajar el cap.
