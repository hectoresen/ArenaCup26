# add-competition-groups — Grupos de competición entre amigos

> **Status**: análisis cerrado 2026-05-18. Pendiente luz verde para
> implementación. Estimación: ~3-4 días de trabajo bien hecho.

## Why

ArenaCup26 hoy ofrece un ranking GLOBAL único. Funciona como producto
público pero pierde casi todo el valor de "competir con MIS amigos":
si juego contra mi cuñado, me importa más quedar #1 en mi grupo de 8
que mi posición #4738 entre 12k jugadores.

Los grupos de competición resuelven esto sin reescribir el scoring
ni los datos del Mundial: son un **filtro + reorder** sobre el mismo
`user_points`. Cero impacto en el cálculo, máximo impacto en el
sentido de "este leaderboard es MÍO".

## What changes

### Modelo de datos (4 tablas nuevas)

```
groups
  - id, creator_id, name, color (paleta de 8), visibility (public/private)
  - max_members (5-100, default 25)
  - created_at, deleted_at (soft)

group_memberships
  - group_id, user_id, joined_at
  - role: 'admin' | 'member'
  - left_at + frozen_points + frozen_streak_max + frozen_simple_hits
    (set cuando user abandona y eligió "mantener perfil en ranking")

group_invitations
  - group_id, invited_by (admin), invitee_id
  - status: 'pending' | 'accepted' | 'rejected'
  - created_at, decided_at

group_links
  - group_id, token, max_uses (0 = ilimitado), uses, revoked_at
  - cap 5 links activos por grupo
```

### Notificaciones nuevas (6 kinds en `notificationKindEnum`)

`group_invited` · `group_joined` · `group_left` · `group_expelled`
· `group_admin_transferred` · `group_deleted`

Push activado solo para los time-sensitive: `group_invited` (te
invitan), `group_expelled` (te echan), `group_admin_transferred`
(eres el nuevo admin).

### Rutas nuevas

```
/social/grupos/nuevo            crear (form: nombre + color + max + visibility)
/social/grupos/<id>             detalle del grupo (ranking + miembros + admin tools)
/social/grupos/descubrir        explorar grupos públicos
/social/grupos/unirse/<token>   landing del invite link → auto-join al confirmar
```

`/social` actual gana sección "Mis grupos" arriba (cards: nombre +
color + miembros count + indicador admin).

`/ranking` gana tabs horizontales scrolleables al inicio:
`[Global] [Grupo X] [Grupo Y] ...`. Default = Global. Si el user no
tiene grupos, NO se renderiza el control (el ranking sigue
mostrándose como hasta ahora).

> **TODO UX**: si las tabs horizontales molestan en móvil con 3
> grupos, considerar segmented control fijo "Global / Mis grupos / Amigos".
> Decisión pendiente de feedback real.

### Lógica de negocio

**Crear grupo**: cualquier user logado. Cap 3 grupos por user
(memberships activas, incluido admin). Si está en 3 → bloqueado con
toast.

**Invitar a un miembro** (solo admin): inserta `group_invitations`
+ notificación in-app + push. El invitee acepta o rechaza desde
`/social` → si acepta, se crea `group_memberships`. Si grupo está
lleno cuando acepta → error.

**Generar link de invitación** (solo admin): genera token único,
configurable `maxUses` (default `0` = ilimitado). Cap 5 links
activos por grupo. Revocable en cualquier momento.

**Unirse vía link**: el invitee aterriza en
`/social/grupos/unirse/<token>` (página servidor). Muestra preview
del grupo (nombre + color + count) + botón "Unirme". Click → server
action que crea `group_memberships` + bump `uses` del link. Si link
revocado o agotado → error con redirección a `/social`.

**Grupo público**: aparece en `/social/grupos/descubrir` con búsqueda
por nombre. Click → preview + "Unirme" libre. Si el grupo está al
tope → "Grupo lleno" sin botón.

**Abandonar**: dialog "¿Quieres que tus puntos sigan apareciendo
como ex-miembro en el ranking del grupo?". Si SÍ → set `left_at` +
copy current `user_points.*` a `frozen_points/streakMax/simpleHits`.
Si NO → DELETE de `group_memberships`.

**Admin abandona**: bloqueado. Modal: "Tienes que [transferir admin]
o [borrar el grupo]" antes de salir.

**Expulsar miembro** (solo admin): DELETE de `group_memberships`
(no congelación — la decisión del admin no respeta la del
ex-miembro). Notificación al expulsado + a todos los miembros
restantes.

**Borrar grupo** (solo admin): soft delete `groups.deleted_at`
+ cascade conceptual: invitaciones pendientes → ignoradas, links
→ inválidos, memberships → siguen para mostrar histórico congelado
pero el grupo no aparece en ningún listado.

### Cálculo del ranking de grupo

Mismo `user_points` underlying. Query:

```sql
SELECT u.*, COALESCE(m.frozen_points, up.total_points) as points, ...
FROM group_memberships m
JOIN users u ON u.id = m.user_id
LEFT JOIN user_points up ON up.user_id = m.user_id
WHERE m.group_id = $1
ORDER BY
  CASE WHEN m.left_at IS NULL THEN 0 ELSE 1 END,  -- activos primero
  points DESC,
  (same tie-break as global: streakMax, simpleHits, predictionsCount, createdAt);
```

**Sparkline + delta semanal**: se computa derivado del snapshot
global existente. Para cada `ranking_snapshots` row del user en
los últimos 7 días, calculamos el rank-en-grupo en memoria
(filter + rerank). Sin tabla nueva.

### Privacidad

El ranking + lista de miembros del grupo solo es visible para
miembros activos + ex-miembros congelados (read-only). Visitantes
externos al grupo (incluso otros users logados) ven la página con
mensaje "Este grupo es privado" (incluso si `visibility=public` la
acción "ver ranking" requiere ser miembro — `public` solo significa
"discoverable + libre unión", no "ranking público").

## Impact

**Affected code**: nuevas server actions en `src/server/groups/`,
nueva entrada en `schema.ts`, 4 páginas Next.js nuevas, sección en
`/social` actualizada, tabs en `/ranking`, kinds nuevos en
`notifications`, push wiring.

**Affected envs**: ninguna nueva. Cap `MAX_GROUPS_PER_USER=3` y
`MAX_LINKS_PER_GROUP=5` quedan hardcoded en código por ahora
(simplicidad — si en producción queremos ajustar, lo pasamos a env).

**Affected tests**: nuevos archivos en `src/server/groups/*.test.ts`.
Estimación: ~15-20 tests. Cubrir: creación, cap 3 grupos, invitar a
ya-miembro (error), link expirado, expulsar, abandonar
congelado/borrado, transfer admin, borrar grupo.

**Backwards-compat**: cero. Es feature aditiva.

**Schema migration**: 1 migration con 4 CREATE TABLE + 6 nuevos
valores al enum `notification_kind`.

**Riesgo**:

- **Performance ranking**: query con LEFT JOIN sobre memberships +
  user_points sobre N miembros. Con 25-100 miembros, despreciable.
- **Notification fan-out**: expulsar miembro → notificación a todos
  los restantes. Si grupo de 100, son 100 notifications + posibles
  pushes. Manejable con la concurrency batch que ya añadimos al
  scoring.
- **Carga de creación**: si un user spam-crea grupos vacíos, el
  cap 3 + las invitaciones cap por grupo limitan el blast radius.

## Decisiones cerradas (resumen)

| # | Decisión | Notas |
|---|---|---|
| 1 | Scoring idéntico al global | Solo filtro+reorder |
| 2 | Salida = snapshot congelado | `frozen_*` cols cuando el user pide mantenerse |
| 3 | Max 3 grupos / user (activos) | Memberships activas, incluido admin |
| 4 | "Público" = discoverable + libre unión | Sin aprobación admin |
| 5 | Logo = color de paleta de 8 | Sin upload, cero infra |
| 6 | Creator no abandona directo | Debe borrar o transferir |
| 7 | Toggle `/ranking` = tabs horizontales | Reconsiderar si UX molesta |
| 8 | MVP completo en 1 fase | Todo discutido aterrizando junto |
| 9 | Invitaciones grupo separadas de friendship | Nueva tabla, nuevos kinds |
| 10 | Solo admin invita / genera links | Control total |
| 11 | Tamaño 5-100, default 25 | Configurable por admin |
| 12 | Sparkline + delta en ranking grupo | Derivado del snapshot global, sin tabla |

## Open items para validar antes de empezar

1. ¿La página del invite link (`/social/grupos/unirse/<token>`) debe
   ser **pública** (visitable sin login para que pueda decidir si
   crear cuenta) o **privada** (login required, redirect post-signin)?
   Mi recomendación: pública con preview limitado (nombre + color +
   count) + CTA "Inicia sesión para unirte".

2. ¿Reducir `max_members` por debajo del current count → bloquear con
   error, o expulsar a los últimos en unirse? Mi recomendación:
   bloquear: "No puedes reducir el cap por debajo de los miembros
   actuales".

3. ¿Si el admin transfiere a un miembro y luego ese miembro abandona,
   se vuelve a aplicar la regla del bloqueo? Sí — el admin sea quien
   sea, no puede abandonar directo.

4. ¿Los ex-miembros congelados pueden seguir visitando `/social/grupos/<id>`?
   Mi recomendación: SÍ en read-only. Pueden ver su propio snapshot
   en el ranking. Sin acciones disponibles (no pueden invitar, salir
   otra vez, etc.).
