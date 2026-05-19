# Design — add-auth-google

## Diagrama de flujo

```
Cliente (JoinCta modal)                          Servidor                                    Google
        │                                            │                                          │
        │ click "Continuar con Google"               │                                          │
        │ signIn("google", { callbackUrl: "/" })     │                                          │
        ├───────────────────────────────────────────►│ POST /api/auth/signin/google             │
        │                                            ├─────────────────────────────────────────►│
        │                                            │                                          │
        │ 302 → consentimiento de Google             │                                          │
        ◄────────────────────────────────────────────┤                                          │
        │                                            │                                          │
        │ usuario aprueba                            │                                          │
        ├───────────────────────────────────────────────────────────────────────────────────────►│
        │                                            │                                          │
        │                                            │ GET /api/auth/callback/google            │
        │                                            ◄──────────────────────────────────────────┤
        │                                            │                                          │
        │                                            │ DrizzleAdapter:                          │
        │                                            │   INSERT INTO users (...)                │
        │                                            │   INSERT INTO accounts (provider, ...)   │
        │                                            │   INSERT INTO sessions (token, ...)      │
        │                                            │                                          │
        │ 302 → "/" + cookie next-auth.session-token │                                          │
        ◄────────────────────────────────────────────┤                                          │
        │                                            │                                          │
```

## Auth.js v5 + Drizzle adapter

`src/lib/auth.ts` ya estaba scaffoldado. Solo cambia:

- `clientId` y `clientSecret` se leen de `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (no de `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`).
- Mantenemos `session: { strategy: "database" }`. El adapter persiste sesiones en la tabla `sessions` del schema; cookies almacenan el `session_token` (la PK de esa tabla).

El adapter tiene firma:

```ts
DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
})
```

Las cuatro tablas existen tal y como las espera Auth.js (ver `src/server/db/schema.ts`).

## Route handlers

Auth.js v5 exporta los handlers desde `src/lib/auth.ts`:

```ts
export const { handlers, signIn, signOut, auth } = NextAuth(config);
```

`handlers.GET` y `handlers.POST` se enchufan al catch-all `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

Eso da automáticamente:

- `GET /api/auth/signin` — listado de providers.
- `GET /api/auth/signin/google` — redirige a Google.
- `GET /api/auth/callback/google` — recibe el code, intercambia por token, crea user/account/session, redirige al `callbackUrl`.
- `GET /api/auth/session` — devuelve la sesión actual (JSON).
- `POST /api/auth/signout` — invalida la sesión.

## Cliente: signIn desde el modal

`JoinCta` (Client Component) usa `signIn` de `next-auth/react`:

```tsx
async function handleGoogleSignIn() {
  setPending(true);
  await signIn("google", { callbackUrl: "/" });
}
```

`signIn` POSTea a `/api/auth/signin/google` con CSRF token, recibe la URL de Google y hace `window.location.replace`. No hace falta `SessionProvider` para eso (solo se necesita para `useSession()`).

## Variables de entorno y validación

| Variable                | Origen                                  | Validación                  |
| ----------------------- | --------------------------------------- | --------------------------- |
| `AUTH_SECRET`           | `openssl rand -base64 48`               | `z.string().min(32)`        |
| `GOOGLE_CLIENT_ID`      | Google Cloud Console → OAuth Client     | `z.string().min(1)`         |
| `GOOGLE_CLIENT_SECRET`  | Google Cloud Console → OAuth Client     | `z.string().min(1)`         |
| `AUTH_TRUST_HOST`       | Opcional, `true` fuera de Vercel        | string → boolean transform  |
| `DATABASE_URL`          | Postgres connection string              | `z.string().url()`          |
| `NEXT_PUBLIC_APP_URL`   | URL pública de la app                   | `z.string().url()`, default |

## Configuración necesaria en Google Cloud Console

Antes de probar el flow, en la consola del proyecto Google:

1. Habilitar la API de Google+ (o "People API" en su versión moderna).
2. Crear un OAuth Client ID de tipo "Web application".
3. Authorized JavaScript origins:
   - `http://localhost:3000` (dev)
   - URL de producción cuando aterrice.
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - URL de producción/api/auth/callback/google.

Si las redirect URIs no coinciden exactamente con lo que Auth.js envía, Google devuelve `redirect_uri_mismatch`.

## Trade-offs considerados

- **`signIn` de `next-auth/react` vs Server Action con `signIn` de `@/lib/auth`**: la versión cliente es más simple para un onClick directo. La Server Action sería ideal si el botón viviera en un `<form action={signInAction}>`. Como nuestro modal es client por la lógica de `useRef` y `useState`, el cliente `signIn` encaja sin fricción.
- **Session strategy database vs JWT**: database añade una query por request pero permite revocación (importante si el usuario quiere "cerrar sesión en todos los dispositivos"). JWT es stateless pero no se puede invalidar antes de su expiración. Database gana por flexibilidad, asumiendo el coste pequeño.
- **Callback URL fija a `/`**: cuando exista dashboard u onboarding, cambiará. Mantenerla simple ahora evita branches condicionales.
- **No middleware todavía**: las rutas privadas no existen. Añadir middleware ahora sería defensa por adelantado sin objetivo. Se añadirá cuando llegue `add-dashboard` o equivalente.
