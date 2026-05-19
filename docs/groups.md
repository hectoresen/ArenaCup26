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
- **Ex-miembro congelado** (`left_at IS NOT NULL` + `frozen_*`): al
  abandonar o ser expulsado, **siempre** se persisten `frozen_points`,
  `frozen_streak_max` y `frozen_simple_hits` en el momento del
  `left_at`. El ex-miembro aparece en el ranking del grupo con esos
  puntos congelados y badge "Ha salido" junto a su nombre. Si vuelve
  a ser invitado y acepta, la misma fila se reactiva (`left_at = NULL`,
  `frozen_* = NULL`) y conserva todo su historial — no entra como
  perfil nuevo.
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
| `GROUP_MEMBERS_MIN/MAX/DEFAULT` | 5 / 100 / 25 | Mínimo para que el ranking tenga sentido competitivo, máximo para no degradar el cálculo. |

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

Las traducciones de label viven en `appShell.bell.dropdown.kind.*`
para los 4 locales (es/en/fr/ar). Todos los kinds `group_*` resuelven
a `/social` en `resolveNotificationHref` — no a una deep-link
individual al grupo, para mantener la UI consistente con la sección
hub.

## Rutas y vistas

- `/social` — hub con sección "Mis grupos" + bandeja de invitaciones.
- `/social/grupos/nuevo` — formulario de creación (con cap check SSR).
- `/social/grupos/[id]` — detalle: ranking + panel admin (si admin).
- `/social/grupos/descubrir` — catálogo COMPLETO de grupos (públicos
  y privados, incluidos los del viewer). Cada card según caso:
  - Soy admin → badge "Eres admin", clicable.
  - Soy miembro → badge "Ya eres miembro", clicable.
  - No miembro + privado → candado 🔒, click → toast bloqueante
    "Solo por invitación o link del admin".
  - No miembro + público → badge "Público", clicable.
- `/social/grupos/unirse/[token]` — landing del invite link (público,
  redirige a login con `?next=` si no autenticado).

## Ranking del grupo

### En `/ranking` (vista principal)

`/ranking` tiene tres tabs URL-driven, mismo patrón que el
mini-leaderboard de `/inicio`:

- `?` (default) → ranking **Global**. SSE-powered `LeaderboardView`.
- `?scope=amigos` → ranking entre viewer + amigos aceptados.
  Pestaña oculta si no tienes amigos.
- `?scope=grupos` → sub-nav con pills por cada grupo del viewer +
  CTA `+ Nuevo`. Sin grupos → empty state con CTA grande.
- `?scope=grupos&g=<id>` → ranking del grupo concreto.

### Componente visual (`GroupLeaderboardView`)

Mismo look-and-feel que el ranking global, reusando `PodiumCard` y
`RankRow` del módulo de leaderboard via adapter
`GroupRankingEntry → Player`:

- Top-3 como **podio** siempre visible (oro/plata/bronce con corona).
  Si hay <3 miembros activos, los slots vacíos se rellenan con
  `<PodiumPlaceholder>` (border dashed + copy juguetón animado:
  "¿Te ves en la cima?", "La plata espera...", "¡Hay sitio aquí!").
- Resto como filas con rachas 🔥 ×N, badge de aciertos y flechas
  ▲ ▼ del delta.
- Ex-miembros congelados nunca al podio aunque tengan los puntos
  (sería incoherente celebrar a quien abandonó). Van siempre a filas
  con `opacity-70` + badge "Ha salido" junto al nombre.

### Query (`getGroupRanking`)

`src/server/groups/queries.ts`. Pipeline:

1. Memberships del grupo (activos + congelados) + datos del user.
2. `user_points` para activos. Los frozen vienen con `frozen_*`.
3. Tie-break (mismo que global): `total_points` desc →
   `streak_max` desc → `simple_hits` desc → `predictionsTotal` desc
   → `created_at` asc.
4. `rankDelta` derivado de `ranking_snapshots` global, filtrando
   snapshots de hace ~7 días por miembros del grupo y rerankeando
   in-memory.

## Logro asociado

**`team-spirit`** ("Espíritu de Equipo"), tier común. Se desbloquea
con la primera membership activa. Importante: este logro **NO está
sujeto al gate `ACHIEVEMENTS_MIN_FINISHED_MATCHES`** — los gates
afectan a logros de rendimiento, no a acciones sociales.

- Trigger: `activeGroupCount >= 1` en `loadContext`.
- Se evalúa tras: `createGroup`, `acceptGroupInvitation`,
  `joinPublicGroup`, `joinGroupViaLink`.
- Bypass del gate: lista `GATE_BYPASS` en `evaluateAndUnlock`.
- Backfill: `scripts/bootstrap.ts` corre `backfillTeamSpirit(db)` en
  cada deploy para reconciliar usuarios con grupos pre-existentes que
  no tenían el logro por el gate. Idempotente, sin notificaciones.

## Decisiones cerradas

- **Scoring**: idéntico al global. Cero rama paralela.
- **Privacy en descubrir**: los grupos privados SÍ aparecen, con
  candado. Decisión UX 2026-05-19: da vida al buscador (es una pista
  de "tu colega tiene un grupo aquí") sin filtrar miembros ni ranking.
  Click → popup explicativo. Acceso directo por URL al detalle de un
  privado donde no eres miembro sigue dando 404.
- **Abandonar/Expulsar**: ambos congelan SIEMPRE el perfil
  (regla 2026-05-19). No hay opción "borrar mi rastro" — el ranking
  histórico es coherente y permite re-invitación con recuperación
  total del historial. Eliminado el toggle `freezeProfile` del input
  de `leaveGroup`.
- **Re-incorporación**: aceptar invitación / unirse via link / unirse
  a público re-activa la membership previa si existía (limpia
  `frozen_*`, resetea `joined_at`). Conservas todo lo conseguido
  porque tu `user_points` siempre estuvo intacto.
- **Admin abandona**: bloqueado por código
  (`is_admin_cannot_leave`). Debe transferir o borrar.
- **Reducir `max_members` por debajo del count actual**: bloqueado
  (`max_members_below_count`). Ya no permitimos auto-expulsiones.
- **Borrar grupo**: soft-delete. Memberships persisten para que el
  ranking congelado de ex-miembros mantenga referencia en BD.

## Tests

- `src/server/groups/tokens.test.ts` — generador de tokens +
  `buildGroupInviteUrl`.
- `src/server/notifications/href.groups.test.ts` — los 6 kinds
  `group_*` rutean a `/social`.
- `e2e/groups-smoke.spec.ts` — smoke tests para redirects auth y
  preservación de tokens. Happy paths quedan como `test.skip` por
  falta de auth-bypass en Playwright (post-Mundial).

## i18n

Las vistas de grupos están en **español hardcoded** en esta fase
inicial. La migración a `next-intl` con `groups.*` keys queda para
después del Mundial — la prioridad ahora mismo es funcionalidad
sobre multi-idioma. Lo único que SÍ está i18n son los labels del
bell dropdown (`appShell.bell.dropdown.kind.group_*`).

## Errores conocidos resueltos

- **`= ANY($1)` con arrays JS** (commit `92def81`): drizzle no
  serializa arrays JS al placeholder PG. Cambiado a `inArray()`.
- **`Date` a columna `timestamp without time zone`** (commit
  `f542ad4`): postgres-js rechaza Date como param. Convertimos a
  string ISO `"YYYY-MM-DD HH:MM:SS"` (sin `Z`).
- **Gate bloqueaba team-spirit** (commit `0032e2e`): logros de
  acción social añadidos a `GATE_BYPASS`.
- **Icono team-spirit caía a dart** (commit `a9e58a7`): faltaba
  `ico-team` en la allowlist `knownIds` de `achSymbolHref`.
