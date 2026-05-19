# Roadmap consolidado — 2026-05-15

Merge entre el análisis del producto (Héctor, 2026-05-15) y el backlog
técnico existente (cyber-audit + propuestas OpenSpec abiertas).
Orden por **bloques** de valor/esfuerzo, no estricto secuencial:
dentro de un bloque las tareas son independientes y pueden moverse.

## Decisiones de producto

### Ranking inamovible + privacy simplificada (2026-05-15)

Tras QA de los bloques A-C, Héctor detectó que el filtro
`WHERE visibility = 'public'` excluía del ranking global a usuarios
con `friends_only` (caso real: cuenta "krawer", con puntos y racha,
desaparecida del ranking público).

**Decisión**: el ranking global es **inamovible**. Todos los users
registrados aparecen siempre con su información básica (nombre,
bandera, puntos, avatar), sea cual sea su `visibility`. La privacy
controla únicamente qué ve un visitante al hacer click en una fila:

- `public` → perfil completo en `/u/<username>`.
- `friends_only` o `private` → cartel "Perfil privado" en la misma
  URL (no `notFound()`). `friends_only` se comporta como `private`
  hasta que aterrice `add-social-friends`.

**Toggles eliminados**: los 5 booleanos antiguos (`showName`,
`showCountry`, `showImage`, `showPoints`, `showAchievements`) se han
retirado del schema y del UI. La decisión se reduce a "perfil
visitable o no" — los toggles solo añadían fricción y emitían señales
contradictorias (¿"sin foto" pero sí "con puntos"?). Migración
`drizzle/0008_simplify_privacy.sql` compacta cada fila al nuevo shape.

---

## Bloque A — Quick wins ✓ (2026-05-17)

- ~~**A1 · Link "Ver ranking completo"**~~ ✓ (MiniLeaderboard
  filas individuales linkan a `/u/<username>`; CTA al ranking
  completo en el header del componente).
- ~~**A2 · Hero stats: rank + racha**~~ ✓ (`progress-cards.tsx`
  muestra "Tu posición · #N" + chip 🔥 ×N en header).
- ~~**A3 · Copy marketing en ranking**~~ ✓ (`leaderboard.marketingCopy`
  en los 4 locales, visible para anon en `LeaderboardView`).
- ~~**A4 · Link "Volver al panel" en `/u/<username>`**~~ ✓
  (2026-05-17: link visible para todos, no solo owner).

## Bloque B — Tie-breaking + online presence ✓ (2026-05-15+)

- ~~**B1 · Última actividad + dot online**~~ ✓ (PING_THROTTLE en
  `(app)/layout.tsx`; `isOnline` deriva en `getRealSnapshot` + se
  expone también en perfil público desde 2026-05-17).
- ~~**B2 · Sistema de desempate**~~ ✓ (columnas `streakMax` +
  `simpleHits` en schema; `getRealSnapshot` ordena por puntos →
  streakMax → simpleHits → predictions count → createdAt).
- ~~**B3 · Docs scoring + FAQ**~~ ✓ (`docs/scoring.md` y FAQ
  detallan el orden de desempate).

## Bloque C — Profile editor ✓ (2026-05-15+)

- ~~**C1 · Cooldowns `nameChangedAt` + `avatarChangedAt`**~~ ✓
  (server actions bloquean dentro de 48h; UI muestra hint
  "{hours}h" desde 2026-05-18).
- ~~**C2 · Galería de avatares pre-curados**~~ ✓ (24 emojis en
  `src/server/profile/avatars.ts`).
- ~~**C3 · Editor inline en `/u/<username>`**~~ ✓ (`EditableName`
  + `AvatarPicker` con cooldown countdown).
- ~~**C4 · Hola {nombre} editable in-place**~~ ✓ (reusa
  `EditableName` con `display={firstName}`).
- ~~**C5 · Caja "Últimas 5 predicciones"**~~ ✓ (`RecentPredictionsCard`
  alimentada por `getPredictionHistory(userId, limit=5)`).
- ~~**C6 · Stats de rachas**~~ ✓ (`StreakStatsCard` con current/
  max/milestones).
- ~~**C7 · Caja "Mis invitaciones"**~~ ✓ (`InvitationsPlaceholderCard`
  enlaza a `/amigos#invitaciones`).

## Bloque D — Cards de próximos partidos rediseñadas ✓ (2026-05-15)

- ~~**D1 · `<MatchCard>` redesign**~~ ✓ (componente
  `<MatchCard>` reescrito con layout VS-centrado, banderas a cada
  lado, fecha bajo el VS y CTA "Predecir" / "Cerrado" según estado).

## Bloque E — Partidos: dos sub-pestañas + bracket ✓ (2026-05-15)

- **E1 · Tabs internas** en `/partidos`: ✓
  - "Todos" (vista actual).
  - "Bracket" (nuevo). Tabs server-side via `?vista=bracket`
    (`MatchesTabs` component, mantiene back/forward).
- **E2 · Vista bracket** (`4.1`): ✓
  - 5 secciones verticales apiladas: Octavos · Cuartos · Semis ·
    3er puesto · Final.
  - Cada sección con grid 2-cols (1-col en viewport <420px) de
    `<BracketCard>` compactas — código FIFA del equipo, marcador
    grande si jugado, chip "Enviada"/"Predecir →" según estado.
  - Rondas vacías muestran placeholder dashed "ronda — aún sin
    partidos confirmados".
  - Query `getBracketMatches` filtra `matches` por
    `stage IN ('round-of-16','quarter','semi','third-place','final')`.

## Bloque F — Invitaciones ✓ (2026-05-16)

- **F1 · Decisión técnica** (`6`):
  - **Modelo elegido**: link de invitación (`?invite=<userId>`)
    sobre email. Justificación: webapp ligera sin servicio de
    email, link tiene mayor conversion rate, no requiere setup
    de proveedor SMTP.
  - **Flujo propuesto**:
    1. User A clica "Invitar a un amigo" → genera link
       `https://wmundial.app/?invite=<A.userId>`.
    2. User B abre el link → cookie `wm_invite_by=<A.userId>`
       set 30 días.
    3. User B hace signup con Google.
    4. Auth.js callback signIn lee la cookie y crea fila en
       nueva tabla `invitations(inviter_id, invitee_id, created_at)`.
    5. Cuando B hace su primera predicción acertada (`first-hit`
       achievement), se desbloquea `better-with-friends` para A
       (logro existente).
- **F2 · Schema** (placeholder en este bloque):
  ```sql
  CREATE TABLE invitations (
    id uuid PRIMARY KEY,
    inviter_id uuid REFERENCES users(id),
    invitee_id uuid REFERENCES users(id) UNIQUE,
    created_at timestamptz DEFAULT now(),
    activated_at timestamptz NULL
  );
  ```
- **F3 · Copys frontales no funcionales**: solo cajas en perfil
  + CTA "Invitar". Botón abre modal con link copiable.
- **F4 · Implementación funcional**: ✓ aterrizado 2026-05-16.
  - Tablas `invitations` (token, max_uses, uses, revoked_at) e
    `invitation_redemptions` (unique invitee, first_hit_at).
  - Middleware intercepta `?invite=<token>` → cookie httpOnly
    30 días → redirect a URL limpia.
  - `events.createUser` de Auth.js redime: insert redemption,
    bump counter, auto-friendship `accepted` bidireccional,
    notificación al inviter.
  - Página `/amigos/invitar` con generar/copiar/rescindir.
    Warning destacado sobre auto-amistad. Cap 5 links activos
    por user. Default 1 uso por link (configurable a futuro).
  - Referral payout: cuando el invitee acierta su primera
    predicción (kind ≠ miss/voided), `payReferralBonusIfFirstHit`
    atómicamente marca `first_hit_at` y paga +10 pts al inviter
    (point_events kind='referral' + user_points.totalPoints +=10).
    Logro `better-with-friends` desbloqueado automáticamente
    para el inviter (out of PENDING_RULES, regla
    `referredFirstHits >= 1`).
  - i18n namespace `invite` en es/en/fr/ar.

## Bloque H — Grupos de competición ✓ (2026-05-19)

> Propuesta `add-competition-groups`. Doc detallado en
> [`groups.md`](groups.md). Decisiones ADR en
> [`decisions.md#1412-grupos-de-competición-2026-05-19`](decisions.md#1412-grupos-de-competición-2026-05-19).

- **H1 · Schema + dominio**: ✓ aterrizado 2026-05-18.
  - 4 tablas (`groups`, `group_memberships`, `group_invitations`,
    `group_links`) + 6 valores nuevos en `notification_kind`.
  - Caps: 3 grupos/user, 5–100 miembros/grupo (default 25), 5
    links/grupo.
  - Server actions: createGroup, updateGroup, deleteGroup,
    transferAdmin, leaveGroup, expelMember, joinPublicGroup,
    joinGroupViaLink, createGroupInvitation, acceptGroupInvitation,
    rejectGroupInvitation, cancelGroupInvitation, createGroupLink,
    revokeGroupLink. Validación Zod en todas.

- **H2 · Rutas + UI**: ✓ aterrizado 2026-05-19.
  - `/social/grupos/{nuevo,[id],descubrir,unirse/[token]}`.
  - Hub en `/social` con "Mis grupos" + bandeja de invitaciones.
  - Panel admin con accordions: invitar, links, miembros, ajustes.
  - `GroupLeaderboardView` reusa `PodiumCard` y `RankRow` del
    leaderboard global → mismo look-and-feel.

- **H3 · Ranking nav redesign**: ✓ aterrizado 2026-05-19.
  - `/ranking` con 3 tabs URL-driven (`?scope=` Global / Amigos / Grupos).
  - Sub-nav con cada grupo del viewer + CTA "+ Nuevo".
  - `getFriendsRanking` query con mismo tie-break que el global.

- **H4 · Logro `team-spirit`**: ✓ aterrizado 2026-05-19.
  - Logro común. Trigger: ≥1 membership activa.
  - `GATE_BYPASS` en unlock.ts permite el desbloqueo sin esperar al
    gate de partidos. Backfill idempotente en `bootstrap.ts`.

- **H5 · Reglas post-launch consolidadas**: ✓ aterrizado 2026-05-19.
  - Leave/Expel siempre congela (sin opción de borrado total).
  - Re-invitación reactiva la misma fila preservando historial.
  - Grupos privados visibles en `/descubrir` con candado + popup.
  - Badge "Ha salido" junto al nombre del ex-miembro en filas.

- **H-pendiente** (post-Mundial, no bloqueante):
  - i18n: las vistas de grupos están en es-hardcoded; migrar a
    `groups.*` namespace de next-intl para en/fr/ar.
  - E2E Playwright happy paths (`test.skip` actuales) cuando exista
    auth-bypass de testing.

## Bloque G — País por IP (decisión)

- **G1 · Análisis RGPD/cookies** (`2.1`):
  - Si solo leemos `request.geo.country` (Vercel/Cloudflare) y NO
    persistimos la IP, NO se necesita banner de cookies
    (legitimate interest). Aplicaríamos en el wizard `/bienvenido`
    pre-rellenando el selector de país.
  - Si persistiéramos la IP, sí necesitaríamos banner.
  - **Decisión recomendada**: pre-rellenar con geo del request +
    user puede cambiar antes de confirmar. Sin persistir IP.
  - Railway no expone `geo` nativamente (es Vercel/Cloudflare-only);
    para hacerlo en Railway necesitamos llamar a un servicio
    externo (ipapi.co, ip-api.com, etc.) — coste latency + free
    tier limitado. Para el sprint actual: no auto-detectar, dejar
    el wizard manual.

## Pendientes del backlog técnico original

Sin solapamiento con el análisis de producto, siguen activos:

- ~~**Canal de contacto público**~~ ✓ (2026-05-18:
  `contact@arenacup26.com` añadido en legales es/en/fr/ar, footer
  global y `VAPID_SUBJECT` en Railway).
- ~~**CRIT-1 · Rotar credenciales filtradas**~~ ✓ (2026-05-18:
  `API_FOOTBALL_KEY` rotada al upgrade a plan Pro $19; allowlist
  de IPs vaciado).
- **Activar Sentry**: crear cuenta + `SENTRY_DSN` en Railway.
  Sin esto, el monitoring sigue en noop. Pasos en
  `docs/security.md §9.2`. (Cosmético: el `org`/`project` en
  `next.config.ts` siguen siendo `webmundial-26`/`webmundial` y
  conviene rebrandear al setear DSN).
- ~~**Páginas legales** (`/privacy`, `/terms`).~~ ✓ (2026-05-15:
  `/legal/privacy` y `/legal/terms` en 4 locales, link desde
  AccountMenu).
- ~~**add-social-friends** (relaciones bidireccionales).~~ ✓
  (2026-05-15: tabla `friendships`, server actions, página
  `/amigos` con bandeja + lista + buscador, CTA contextual en
  `/u/<username>`, `canViewProfile` resuelve `friends_only`).
- ~~**add-leaderboard-sse** (push real).~~ ✓
  (2026-05-15: endpoint `/api/leaderboard/stream` SSE periódico
  (15s tick + 30s heartbeat + 5min max duration). Hook
  `useLiveSnapshot` cliente sustituye el state inicial SSR.
  Mejora futura: pasar de tick periódico a event-driven cuando
  aterrice un bus pub/sub).
- ~~**add-ranking-history** (delta ▲/▼ + sparkline reales).~~ ✓
  (2026-05-15: tabla `ranking_snapshots`, cron diario
  `/api/cron/snapshot-ranking` a las 00:05 UTC, `getRankHistory`
  alimenta la card "Tu posición" con sparkline SVG + rankDelta).
- ~~**add-matches-filters** (filtros sobre `/partidos`).~~ ✓
  (2026-05-15: chips por estado [todos/live/scheduled/finished],
  fase [grupos/eliminatoria] y "solo mis predicciones".
  Server-side via search params, URL compartible).
- ~~**add-live-scoring** (workflow `*/2` durante partidos en curso).~~ ✓
  (2026-05-15: cron `/api/cron/live-scoring` cada 2 min con check
  `shouldSyncLive` previo — solo gasta requests a api-football
  cuando hay partidos `live` o un kickoff en ±15-30 min).
- ~~**add-product-analytics** (Plausible).~~ ✓
  (2026-05-15: Script `<head>` condicional a `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.
  Privacy-friendly, sin cookies → no banner. Setup en
  `docs/security.md §9.3`).
- ~~**add-mobile-polish** (PWA + safe-area iOS + a11y audit).~~ ✓
  (2026-05-15: viewport con `viewport-fit=cover`, safe-area-inset
  en body, theme-color, manifest.webmanifest + icon.svg, skip link
  WCAG 2.4.1, focus-visible, `prefers-reduced-motion`).
- ~~**add-data-resilience** (pg_dump → R2 + status page + PR envs).~~ ✓
  (2026-05-15: GitHub Action `db-backup.yml` diaria 03:00 UTC con
  pg_dump → S3-compatible bucket + verificación gzip. Endpoint
  `/api/status` + página `/status`. PR envs aparcadas — Railway lo
  hace via "PR environments" si quieres activarlo manualmente).
- ~~**add-e2e-tests** (Playwright golden paths).~~ ✓
  (2026-05-15: 6 specs sobre páginas públicas + skip-link + manifest
  + /api/status. CI workflow `e2e.yml` con Postgres service y
  drizzle-kit migrate antes de los tests).
- ~~**add-web-push-notifications** (retención fuera de app).~~ ✓
  (2026-05-15: tabla `push_subscriptions`, service worker `/sw.js`,
  server actions subscribe/unsubscribe + `sendPushTo` helper, opt-in
  UI en `/ajustes/privacidad` con flujo permission + register.
  Noop si `NEXT_PUBLIC_VAPID_PUBLIC_KEY` no está set. Pasos en
  `docs/security.md §9.5`).

## Orden de ataque sugerido

```
Sprint 1 (esta sesión):  Bloque A + Bloque B
Sprint 2:                Bloque C (profile editor)
Sprint 3:                Bloque D (cards rediseñadas)
Sprint 4:                Bloque E (bracket Mundial)
Sprint 5:                Bloque F (invitaciones, fase implementación)
Sprint 6+:               add-social-friends + leaderboard-sse + …
```

Esto es una guía; cualquier ítem se puede mover si descubrimos
un dependency o si el coste real difiere.
