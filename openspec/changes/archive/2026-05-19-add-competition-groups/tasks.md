# Tasks — add-competition-groups

## 1 · Schema + migration

- [ ] Definir 4 tablas en `src/server/db/schema.ts`: `groups`,
      `group_memberships`, `group_invitations`, `group_links`.
- [ ] Añadir 6 valores al `notificationKindEnum`.
- [ ] Generar migration con `drizzle-kit generate`. Revisar SQL
      manualmente antes de commit.
- [ ] Aplicar localmente con `db:migrate`, verificar shape.

## 2 · Dominio: `src/server/groups/`

- [ ] `types.ts`: shapes públicos (`GroupSummary`, `GroupDetail`,
      `GroupMember`, `GroupInvitation`, etc.).
- [ ] `queries.ts`: getUserGroups, getGroupDetail, getGroupRanking,
      getDiscoverableGroups (paginado). Tests para cada uno.
- [ ] `actions.ts`: createGroup, updateGroup (admin), deleteGroup,
      transferAdmin, joinViaLink, joinPublic. Validation con Zod.
- [ ] `invitations.ts`: inviteToGroup, acceptInvitation,
      rejectInvitation. Notificaciones in-app + push para `group_invited`.
- [ ] `links.ts`: createLink, revokeLink, validateAndConsumeLink.
- [ ] `membership.ts`: leaveGroup (con dialog congelado/borrado),
      expelMember (admin). Snapshot a `frozen_*` cuando aplica.
- [ ] `caps.ts`: helpers para verificar cap 3 grupos/user y cap
      max_members/grupo. Devuelven error tipado para que la UI
      muestre toast claro.

## 3 · Rutas Next.js

- [ ] `/social/grupos/nuevo` — form de creación. Server action.
- [ ] `/social/grupos/<id>` — detalle. Server component principal +
      sub-componentes cliente para admin tools (`<GroupAdminPanel>`).
- [ ] `/social/grupos/descubrir` — listado público con buscador
      simple por nombre. Paginación basic.
- [ ] `/social/grupos/unirse/<token>` — landing del link.
      **Pública** (visitable sin login). Si no logado → CTA "Inicia
      sesión para unirte" con redirect callback. Si logado y no
      miembro → "Unirme". Si logado y ya miembro → redirect a
      `/social/grupos/<id>`.
- [ ] Actualizar `/social/page.tsx`: añadir sección "Mis grupos"
      arriba con cards (nombre + color + count + admin badge).
- [ ] Actualizar `/ranking/page.tsx`: tabs horizontales si el user
      tiene grupos. Default Global.

## 4 · Componentes UI

- [ ] `<GroupCard>`: tarjeta para listing. Color accent + nombre +
      count + chip "Admin" si aplica.
- [ ] `<GroupHeader>`: header del detalle. Color + nombre + count
      + admin actions dropdown.
- [ ] `<GroupRanking>`: reuso de `<RankRow>` con prop `frozen` para
      el styling distinto. Ex-miembros con etiqueta + gris.
- [ ] `<GroupMembersList>`: lista de miembros con su rank-en-grupo.
- [ ] `<GroupAdminPanel>`: tools admin (invitar, editar, transferir,
      borrar, expulsar miembros uno-a-uno).
- [ ] `<CreateGroupForm>`: nombre + color (paleta 8) + max_members
      slider + visibility radio.
- [ ] `<JoinViaLinkPanel>`: preview del grupo + CTA "Unirme" /
      "Inicia sesión".
- [ ] `<GroupTabs>` en `/ranking`: tabs horizontales scrolleables
      con `[Global] [Grupo X] ...`.

## 5 · Notificaciones

- [ ] Añadir kinds al enum + entrada en `notifications/href.ts`
      (route to `/social/grupos/<id>` o `/social` según kind).
- [ ] Wirear `notifyWithPush` con `pushable: true` para los 3
      time-sensitive: invited, expelled, admin_transferred.
- [ ] Push subject + body templates per kind, i18n en es/en/fr/ar.

## 6 · Tests

- [ ] `groups/queries.test.ts` — getUserGroups, getGroupDetail,
      getGroupRanking (con/sin ex-miembros), getDiscoverableGroups.
- [ ] `groups/actions.test.ts` — createGroup, cap 3 grupos error,
      updateGroup, deleteGroup, transferAdmin.
- [ ] `groups/invitations.test.ts` — invitar, ya-miembro error,
      duplicate-pending error, acceptar, rechazar.
- [ ] `groups/links.test.ts` — generar, revocar, validar, agotado,
      cap 5 activos por grupo.
- [ ] `groups/membership.test.ts` — leave con congelado, leave con
      borrado, expel, admin can't leave directo.
- [ ] Edge cases: borrar grupo con miembros congelados (preservar
      `group_memberships` para que vean histórico).

## 7 · i18n

- [ ] Nuevo namespace `groups` en es/en/fr/ar:
      title/create/edit/delete/leave/expel/transferAdmin/joinPublic/
      joinPrivate/colorOptions/visibilityOptions/sizeRange/notifications
      bodies/etc.
- [ ] Actualizar `appShell` / `social` para integrar enlaces y
      sección "Mis grupos".

## 8 · Docs

- [ ] `docs/groups.md`: doc del feature (flow de uso, decisiones).
- [ ] Actualizar `README.md` con la nueva subsección bajo "Amistad
      y social".
- [ ] Actualizar `docs/pre-launch-checklist.md` con el item del
      feature.
- [ ] Cuando aterrice, archivar la propuesta a
      `openspec/changes/archive/add-competition-groups/`.

## 9 · Rollout

- [ ] Deploy inicial silencioso (sin anuncio).
- [ ] QA con 2-3 grupos reales antes del Mundial.
- [ ] Métricas a vigilar: grupos creados/día, % users con ≥1 grupo,
      ranking de grupo más activo. Plausible custom events.
