# Design — add-account-menu

## Orquestación del slot top-right

```
src/app/page.tsx (Server Component)
  ├─ session = await auth()
  └─ <LeaderboardView snapshot={...} user={session?.user ?? null} />

src/components/leaderboard/leaderboard-view.tsx (Client)
  └─ <div className="fixed top-3 right-3 z-30 ...">
       {user ? <AccountMenu user={user} /> : <JoinCta />}
     </div>
```

Decidir server-side qué componente renderizar evita:

- Necesidad de un `<SessionProvider>` cliente.
- Flash de UI incorrecta entre el primer render y la hidratación: el HTML servido ya trae el componente correcto.

`LeaderboardView` debe ser Client (lo es ya) porque más adelante recibirá eventos SSE en vivo. La rama del slot vive dentro suyo, por lo que la decisión condicional en JSX es trivial.

## Trigger del menú

Pill rounded-full con dos elementos:

1. **Avatar 28px**: si `user.image` viene de Google (típicamente `https://lh3.googleusercontent.com/...`), se renderiza como `<img>` directo. Si es null, se muestran las **iniciales** sobre fondo gold (mismo gradiente que el avatar del podio del podio del leaderboard, para reusar lenguaje).
2. **Hamburguesa SVG** 16×14, tres trazos de 2px stroke en `text-foreground/80`.

Borde `border-gold/30`, fondo `bg-card/90` con `backdrop-blur`. Hover sube a `border-gold/50` + `bg-card-hover/90`.

`aria-haspopup="menu"`, `aria-expanded={open}`, `aria-label="Abrir menú de cuenta"` (cambia a "Cerrar..." cuando está abierto).

## Dropdown

`absolute right-0 mt-2 w-64 origin-top-right`. Animación `popIn` ya definida en `globals.css`.

Estructura:

```
┌──────────────────────────────────┐
│  Carlos Mendoza                  │  ← font-display, gold, truncate
│  carlos@gmail.com                │  ← muted, 11px, truncate
├──────────────────────────────────┤
│  ↪  Cerrar sesión                │  ← menuitem, hover bg blanco/5
└──────────────────────────────────┘
```

Border `border-gold/30`, fondo `bg-gradient-to-br from-card-hover to-card`, sombra fuerte para separarlo del leaderboard que queda detrás. Cada item es un `<button role="menuitem">`.

## Comportamiento

- **Toggle**: click en el trigger alterna `open`.
- **Click fuera**: listener `mousedown` en `window` cierra si el target no está dentro del contenedor.
- **Escape**: cierra y devuelve foco al trigger (UX de teclado).
- **Sign-out**: handler async, marca `signingOut=true` para deshabilitar el botón y cambiar la copy a "Cerrando sesión…", llama `signOut({ callbackUrl: "/" })`. Auth.js redirige; al volver, la página se renderiza desde cero y el `auth()` del RSC ya devuelve null.

## Trade-offs

- **`<img>` vs `next/image`** para el avatar: `<img>` evita configurar `images.remotePatterns: ['lh3.googleusercontent.com']` en `next.config.ts`. El avatar es 28px, no se beneficia mucho de la optimización. Cuando montemos un sistema de avatares más rico (perfiles públicos), reevaluar.
- **Server-side decision vs `useSession`**: la primera es más simple y evita SessionProvider. Costo: si la sesión expira mientras el usuario está en la página, la UI no se entera hasta una recarga. Asumible para fase 1; cuando haya rutas client-side densas (SPA), se añade SessionProvider.
- **Click outside vs `<details>` nativo**: `<details>` cerraría con click fuera automáticamente, pero su estructura HTML no encaja con la composición de iconos + dropdown rico. La complejidad extra de gestionar a mano es trivial.
