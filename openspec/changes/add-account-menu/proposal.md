# add-account-menu

## Why

Tras `add-auth-google`, el usuario puede iniciar sesión y vuelve al leaderboard. Pero la UI **no refleja** que tiene sesión activa: sigue viendo el mismo botón "Predecir ahora" como si fuera anónimo. Tampoco tiene manera de cerrar sesión.

Esta propuesta materializa el slot que `add-join-cta` reservó: cuando hay sesión, el `<JoinCta />` se sustituye por un **menú de cuenta** (estilo hamburguesa con avatar) que, en esta iteración, ofrece **una sola acción: cerrar sesión**. El menú es la base sobre la que se añadirán futuras opciones (Mi perfil, Mis predicciones, Configuración, etc.) cuando aterricen sus capabilities.

## What changes

Capability nueva: **`account-menu`**.

- Componente `<AccountMenu />` (Client) con:
  - Trigger: pill con avatar de Google (fallback a iniciales) + icono hamburguesa, gold border.
  - Dropdown: cabecera con nombre + email del usuario, separador, item "Cerrar sesión".
  - Cierra con click fuera, Escape o click en una opción.
  - `signOut({ callbackUrl: "/" })` desde `next-auth/react` al pulsar "Cerrar sesión".
- `src/app/page.tsx` resuelve `auth()` server-side y pasa `session?.user` a `<LeaderboardView />`.
- `<LeaderboardView />` decide qué renderizar en el slot top-right:
  - Sin user → `<JoinCta />` (lo de hoy).
  - Con user → `<AccountMenu user={...} />` (lo nuevo).

**No incluye**:

- Más opciones del menú aparte de "Cerrar sesión". Cuando aterrice cada capability privada (dashboard, perfil propio en edición, configuración) se añadirá el item correspondiente en propuestas dedicadas.
- Redirección post-login al área privada. Hoy `signIn` y `signOut` apuntan a `/`. Cuando exista `/dashboard` o equivalente, se cambia el `callbackUrl`.
- Onboarding del primer login (elegir username, país). Va en `add-auth-onboarding` cuando exista mockup.

## Impact

- **Bloquea**: nada.
- **Desbloquea**:
  - El usuario puede cerrar sesión limpiamente.
  - Cada capability privada futura (dashboard, perfil, settings) puede añadir su item al `AccountMenu` con un PR puntual.
- **Riesgos**:
  - El componente lee `session.user` server-side y lo pasa por prop. La info viaja al cliente como datos estáticos. Si por algún motivo la sesión expira durante la navegación, la UI no se entera hasta una recarga; en este momento es asumible (es un MVP), pero cuando haya navegación SPA densa habrá que reconsiderar (vía `useSession` + `<SessionProvider>` o invalidar route caches).
  - El avatar de Google se sirve como `<img>` directo, no a través de `next/image`. Coste: sin optimización; beneficio: sin necesidad de configurar `images.remotePatterns` para `lh3.googleusercontent.com`.

## Decisiones tomadas

- **Trigger visual**: avatar (Google profile picture) + 3 líneas hamburguesa, dentro de un pill gold, en el mismo slot `fixed top-right` que ocupaba `JoinCta`. Mantiene el peso visual sin ruido extra.
- **Fallback de avatar**: iniciales del nombre o email cuando `user.image` es nulo (algún proveedor podría no entregarlo).
- **Cabecera del dropdown**: nombre en gold + email en muted, ambos truncados. Da contexto al usuario sin necesidad de un perfil dentro del menú.
- **Decisión server vs client de qué renderizar**: hecha en `page.tsx` (RSC) vía `await auth()` y pasada como prop. Evita necesidad de `<SessionProvider>` y previene flash de UI incorrecta en hidratación.
- **Sign-out**: `signOut({ callbackUrl: "/" })`. Vuelve al leaderboard como anónimo, donde `<JoinCta />` reaparece automáticamente.
