# add-public-profile-page

## Why

`docs/public-profile.md` cerró scope el 2026-05-06: cada usuario tiene un perfil **público** en `/u/<username>` con identidad, stats y catálogo de logros. Sin esta capability **el usuario logado no tiene a dónde ir cuando quiere ver/compartir "su" perfil** — el AccountMenu solo tiene FAQ y Cerrar sesión. Gap detectado al probar el dashboard en local.

Junto con esto cerramos la decisión que faltaba en `docs/public-profile.md`: la generación del `username`. Auto-derivado desde el nombre del provider Google en el primer login (con sufijo numérico si colisiona).

## What changes

Capability nueva: **`public-profile-page`**.

### Username auto-gen

`src/server/users/username.ts`:

- `slugifyName(name)`: pure function que normaliza un nombre (NFD + strip diacríticos + lowercase + `[a-z0-9-]`) a un slug ≤ 20 chars.
- `resolveAvailableUsername(base, isTaken)`: dado un slug base y una función `isTaken`, devuelve el primer disponible probando `base`, `base-2`, …; si todo está tomado tras 100 intentos, fallback `user-<timestamp36>`.

Auth.js callback `events.createUser` invoca ambos contra la BD y rellena `users.username`. Solo se ejecuta la primera vez que el usuario se loguea — no se sobreescribe si ya existe.

Extensión de tipos `src/types/next-auth.d.ts` para que `session.user` exponga `id` y `username`.

### Página `/u/[username]`

`src/app/[locale]/u/[username]/page.tsx`:

- SSR público (sin guard de sesión).
- `getPublicProfile(username)` devuelve `null` si el username no existe → `notFound()`.
- El perfil siempre es público mientras la cuenta esté activa.

### Data layer

`src/server/public-profile/`:

- `types.ts`: `PublicProfile` = `{ user: { name, username, country, flag, image }, stats: { rank, totalPlayers, points, pointsDelta }, achievements: { unlocked: Set<id>, lastUnlockedAt } }`.
- `queries.ts`:
  - `getPublicProfile(db, username)` con joins a `users`, `userPoints`, `userAchievements`.
  - Pure helpers en `transforms.ts`: agrupación de logros por tier siguiendo el orden del `ACHIEVEMENT_CATALOG`.

### Componentes

`src/components/public-profile/`:

- **`ProfileHero`** — avatar con ring conic dorado + nombre + `@username` + country pill + `<CopyLinkButton>`.
- **`CopyLinkButton`** — client, copia `window.location.href` al clipboard; toast "Copiado" 2s.
- **`StatsRow`** — 2 stat cards: posición global (gold) y puntos (blue/green).
- **`AchievementsAccordion`** — `<details>`/`<summary>` nativos (no JS):
  - Trigger: "X de 24 desbloqueados" + mini-progress.
  - Open: barra de progreso completa + secciones por tier con cards.
  - Decisión cerrada: cerrado por defecto (`docs/public-profile.md` §Decisiones cerradas 2026-05-07).
- **`AchievementCard`** — variante locked (greyscale + lock) y unlocked (color por tier). Tiers legendario+ tienen `share-chip` al hover (`/u/<username>#ach-<id>`).
- **`TierSection`** — header con nombre del tier + count + grid de cards.

### Link "Mi perfil" en AccountMenu

El `AccountMenu` existente añade un nuevo item al dropdown:

- Texto: "Mi perfil" (i18n).
- Destino: `/u/${session.user.username}`. Si por algún motivo el username es null (race condition con `createUser`), el link no se renderiza.
- Posición: primero del menú (antes del FAQ).

### i18n

Namespace `publicProfile.*` en es/en/fr/ar:

- Identidad: `viewProfile`, `copyLink`, `copied`, `flagAria`.
- Stats: `rankLabel`, `rankOfTotal`, `pointsLabel`, `weeklyDelta`.
- Achievements: `accordionLabel`, `unlockedCount`, `tier.common/.rare/.epic/.legendary/.mythic/.goat`, `lockedLabel`, `shareLabel`, `unlockedAt`.

### Tests

- **username** (`username.test.ts`): 21 casos cubriendo slugify (acentos, símbolos, longitud, fallback) y resolveAvailable (libre, colisión, suffix limit, fallback final).
- **transforms** (`public-profile/transforms.test.ts`): agrupación de catálogo por tier, marcado unlocked/locked, share-chip eligibility (legendary+).
- **Componentes**: ProfileHero, StatsRow, AchievementsAccordion, AchievementCard, CopyLinkButton. Mínimo 4-6 casos por componente cubriendo variantes (con/sin imagen, con/sin país, locked/unlocked, viewer-is-owner/visitor).
- **Page**: integración con mock data, notFound cuando username no existe.

**No incluye:**

- Catálogo editable del usuario (cambiar avatar/país/etc.) — `add-account-settings`.
- Onboarding completo (elegir username/país tras Google) — `add-onboarding`. El auto-gen es un puente.
- Stats avanzadas (mejor racha, hitos individuales) — fuera de scope explícito en `docs/public-profile.md`.
- Indicador "Activo hoy" — requiere `users.last_active_at` actualizado en cada acción; cuando aterrice se conecta sin tocar este componente.
- OG image / SEO completo — `<meta>` básicos sí, pero la generación de imagen dinámica viene en `add-public-profile-og`.

## Impact

- **Bloquea**: nada inmediato.
- **Desbloquea**:
  - UX del usuario logado: ya puede llegar a su perfil desde el AccountMenu.
  - Compartir URL pública.
  - `add-onboarding` reutiliza `slugifyName` para sugerir el username inicial editable.
- **Riesgos**:
  - El auto-gen produce algunos slugs poco bonitos (`cagr-ozturk` por `Çağrı`). Mitigación: el usuario podrá editar en `add-onboarding`.
  - Rutas reservadas (`/u/api`, `/u/admin`) podrían colisionar con un username futuro. Mitigación: blacklist en `slugifyName` cuando aterrice la propuesta `add-username-edit`. Por ahora el riesgo es teórico (Google profile names raramente coinciden).
- **Compromisos cerrados (que materializa esta propuesta)**:
  - URL: `/u/<username>` (no `/u/<id>`).
  - Acordeón de logros cerrado por defecto.
  - Auto-gen del username sin onboarding bloqueante.
