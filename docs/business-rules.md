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
