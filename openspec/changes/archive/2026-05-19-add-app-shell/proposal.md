# add-app-shell

## Why

`docs/iniciopaneldeusuario.txt` (panel privado del usuario) trae un top-nav fijo con tabs (Inicio/Partidos/Ranking/Logros), bell de notificaciones, avatar gradiente y bottom-nav móvil. Esa misma envoltura se reutiliza en `/partidos`, `/ranking` y `/logros` (todas las páginas del área logada). Si la metemos directamente dentro de `add-home-dashboard`, queda atrapada en una página y se duplicará cuando aterricen las otras tres rutas.

Esta capability extrae el shell como pieza independiente y reusable para todo el área logada (`/inicio`, `/partidos`, `/ranking`, `/logros`, `/u/<username>`, etc.). La landing pública mantiene su nav actual sin tocar.

## What changes

Capability nueva: **`app-shell`**.

### Layout

`src/app/[locale]/(app)/layout.tsx`:

- Route group `(app)` que envuelve todas las rutas privadas con el shell.
- Server component que llama `auth()` y redirige a `/` si no hay sesión.
- Renderiza `<AppShell>{children}</AppShell>`.

### Componentes

`src/components/app-shell/`:

- **`AppShell`** — server component que mete `<TopNav>` y `<BottomNav>`, define el `<main>` con `max-width: 720px` y aplica `padding-top: 60px` para compensar el top-nav fijo + `padding-bottom: 88px` en móvil para el bottom-nav.
- **`TopNav`** — server. Logo trofeo + brand "26 / WC 26", tabs (4 enlaces Inicio/Partidos/Ranking/Logros con icono inline-svg y estado activo por `usePathname` server-side), `NotificationBell` y `AppAvatar`.
- **`BottomNav`** — server. Solo visible <640 px (`display: none` en CSS). Los mismos 4 tabs con icono encima del label.
- **`NotificationBell`** — client component. Recibe `unreadCount: number` por prop. Muestra el badge si > 0. Click-handler abre un dropdown vacío (TODO: `add-notifications` lo llena en otra propuesta).
- **`AppAvatar`** — server. Recibe `user: { name, image }`. Muestra el ring gradiente conic + iniciales si no hay `image`, o `<img>` si hay foto de Google.

### i18n

Mensajes nuevos en `src/i18n/messages/{es,en,fr,ar}.json` bajo el key `appShell.*`:

- `appShell.tabs.home` / `.matches` / `.ranking` / `.achievements`
- `appShell.brand.year` / `appShell.brand.tag`
- `appShell.bell.aria` / `appShell.avatar.ariaOf`

### Estilo

- Variables CSS ya existen en `globals.css` (gold/bronze/silver/etc.). Añadimos las dos que faltan: `--nav-h: 60px` y `--bn-h: 64px`.
- Animación `trophyFloat` para el logo. Respeta `prefers-reduced-motion`.
- Avatar gradiente con `conic-gradient` + iniciales en `font-display`.

### Tests

- **TopNav**: render con/sin sesión, marca el tab activo según pathname, los 4 tabs tienen `href` correcto, locale en URL si difiere del default.
- **BottomNav**: render con visibilidad CSS testeada por `class`, mismos `href` que el top-nav (consistencia).
- **AppAvatar**: con `image` URL renderiza `<img>`; sin image renderiza iniciales (primera letra de cada palabra del `user.name`).
- **NotificationBell**: con `unreadCount > 0` muestra badge con número; con `unreadCount = 0` no muestra badge.
- **`(app)` layout**: si `auth()` devuelve null, `redirect("/")`. Se testea con `vi.mock` sobre Auth.js.

**No incluye**:

- Contenido de las páginas (`/inicio`, `/partidos`, etc.). Vienen en sus propias propuestas.
- Funcionalidad real del bell — el dropdown va con `add-notifications`.
- Edición de perfil o menu desplegable del avatar — eso lo cubre `add-account-menu` (parcialmente ya existe).
- Animaciones decorativas como floaters de balones — eso vive en `add-home-dashboard` porque son específicas de la home.

## Impact

- **Bloquea**: `add-home-dashboard`, `add-matches-page`, `add-ranking-page`, `add-achievements-page`, `add-public-profile-page` (todas necesitan el shell).
- **Desbloquea**: `add-home-dashboard` puede arrancar.
- **Riesgos**:
  - El shell decide el padding global; cambios futuros impactan a todas las páginas del área. Tests sobre cada página validan que el contenido no queda cortado por el nav fijo.
  - El bell sin notificaciones reales tiene un badge fake durante un tiempo. Decisión cerrada: lo arrancamos con `unreadCount = 0` hasta que `add-notifications` aterrice.
- **Compromisos cerrados**:
  - La home pública `/` no usa este shell. Mantiene su nav landing con CTA join.
  - El avatar abre un menú existente (`AccountMenu` de `add-account-menu`). El componente nuevo `AppAvatar` lo reusa.
