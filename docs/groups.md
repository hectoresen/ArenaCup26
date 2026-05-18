# Grupos de competición

> Feature shipped por la propuesta `add-competition-groups` (mayo 2026).
> Permite a los usuarios competir en **rankings privados** contra
> amigos sin reescribir el cálculo de puntos: cada grupo es un
> **filtro + reorder** sobre el mismo `user_points` que alimenta el
> ranking global.

## Conceptos clave

- **Grupo** (`groups`): contenedor con nombre, color de paleta de 8,
  visibilidad (`public` / `private`), cap configurable de miembros
  (5–100, default 25), soft-deletable.
- **Admin**: rol con permisos para invitar, expulsar, generar links,
  editar y borrar. Siempre exactamente 1 admin por grupo —
  transferible.
- **Member**: rol estándar. Puede abandonar el grupo libremente.
- **Ex-miembro congelado**: al abandonar con la opción "mantener
  perfil en ranking", se persisten `frozen_points`,
  `frozen_streak_max` y `frozen_simple_hits` en el momento del
  `left_at`. El ex-miembro aparece read-only en el ranking del grupo
  con esos puntos congelados.
- **Invitación directa** (`group_invitations`): admin → user concreto,
  1-a-1. Estados: `pending` → `accepted` / `rejected`.
- **Link de invitación** (`group_links`): token reutilizable
  (`base64url` 16 bytes), opcionalmente con `max_uses` capado, con
  contador `uses` y soft-revocable. Cap 5 links activos por grupo.

## Caps (`src/server/groups/caps.ts`)

| Constante | Valor | Razón |
| --- | --- | --- |
| `MAX_GROUPS_PER_USER` | 3 | Mantiene el ranking-tabs del usuario en una UI manejable y evita "joiners" sin foco. |
| `MAX_LINKS_PER_GROUP` | 5 | Suficientes contextos de compartir (WhatsApp familia, Telegram trabajo, etc.) sin proliferación. |
| `GROUP_MEMBERS_MIN/MAX/DEFAULT` | 5 / 100 / 25 | Mínimo para que el ranking tenga sentido competitivo, máximo para no degradar el cálculo del ranking. |

## Notificaciones

Se añadieron 6 kinds al `notificationKindEnum`:

| Kind | Push activo | Destinatario | Trigger |
| --- | --- | --- | --- |
| `group_invited` | sí | invitee | admin envía invitación |
| `group_joined` | no | admin | nuevo miembro acepta invitación / link |
| `group_left` | no | admin | miembro abandona |
| `group_expelled` | sí (al expulsado) | expulsado + resto silencioso | admin expulsa |
| `group_admin_transferred` | sí | nuevo admin | admin transfiere |
| `group_deleted` | configurable | todos | admin borra |

Todos resuelven a `/social` en `resolveNotificationHref` — no a una
deep-link individual al grupo, para mantener la UI consistente con la
sección hub. El destino concreto lo elige la card en `/social`.

## Rutas y vistas

- `/social` — hub con sección "Mis grupos" + bandeja de invitaciones.
- `/social/grupos/nuevo` — formulario de creación (con cap check SSR).
- `/social/grupos/[id]` — detalle: ranking + panel admin (si admin).
- `/social/grupos/descubrir` — listing público con búsqueda por nombre.
- `/social/grupos/unirse/[token]` — landing del invite link (público,
  redirige a login si no autenticado).

## Ranking del grupo

Función: `getGroupRanking(db, groupId)` en `src/server/groups/queries.ts`.

1. Selecciona memberships del grupo (activos + congelados) + datos del
   user + `user_points` para activos.
2. Tie-break (mismo que global): `total_points` desc → `streak_max`
   desc → `simple_hits` desc → `created_at` asc.
3. Calcula `rankDelta` derivado de `ranking_snapshots` global,
   filtrando snapshots de hace ~7 días por miembros del grupo y
   rerankeando in-memory.

## Decisiones cerradas

- **Scoring**: idéntico al global. Cero rama paralela. Cero impacto en
  el cálculo de puntos del torneo.
- **Privacy**: grupos `private` no aparecen en descubrir ni se pueden
  abrir por URL si no eres miembro (devuelve 404, no 403, para no
  filtrar existencia).
- **Admin abandona**: bloqueado por código (`is_admin_cannot_leave`).
  Debe transferir o borrar.
- **Reducir `max_members` por debajo del count actual**: bloqueado
  (`max_members_below_count`). Ya no permitimos auto-expulsiones.
- **Borrar grupo**: soft-delete. Memberships persisten para que el
  ranking congelado de ex-miembros siga teniendo referencia en BD.

## Tests

- `src/server/groups/tokens.test.ts` — propiedades del generador de
  tokens + el helper `buildGroupInviteUrl`.
- `src/server/notifications/href.groups.test.ts` — los 6 nuevos kinds
  routean a `/social`.

> **Pendiente** (sin bloqueo de release): integration tests E2E
> Playwright para los happy paths de crear/invitar/aceptar/abandonar.
> Se ejecutarán manualmente como QA antes del Mundial.

## i18n

Las vistas de grupos están en **español hardcoded** en esta fase
inicial. La migración a `next-intl` con `groups.*` keys queda para
después del Mundial — la prioridad ahora mismo es funcionalidad sobre
multi-idioma. El resto de la app sigue funcionando con sus 4 locales
intactos (es / en / fr / ar); solo este módulo está pendiente.
