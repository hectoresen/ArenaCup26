# add-auth-google

## Why

`add-join-cta` dejó montada la superficie de UI: el botón "Predecir ahora", el modal y el botón "Continuar con Google" con el logo oficial. Pero el `onClick` del botón Google es un `console.info` y no hace nada real.

Esta propuesta **conecta el flow de Google OAuth** vía Auth.js v5 con el adapter Drizzle ya scaffoldado en `src/lib/auth.ts`, expone los route handlers en `/api/auth/*`, y hace que el botón del modal redirija al consentimiento de Google y devuelva al usuario con sesión iniciada.

## What changes

Capability nueva: **`auth`**.

- Variables de entorno renombradas a la convención `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (las que Google emite literalmente con esos nombres en su consola). Validadas con Zod en `src/lib/env.ts`.
- `src/lib/auth.ts` actualizado para consumir esas variables.
- Nuevo route handler `src/app/api/auth/[...nextauth]/route.ts` que expone los endpoints de Auth.js (`/api/auth/signin`, `/api/auth/callback/google`, `/api/auth/session`, `/api/auth/signout`, etc.).
- `JoinCta`: el `onClick` del botón Google ahora llama a `signIn("google", { callbackUrl: "/" })` desde `next-auth/react`. Estado `pending` para deshabilitar el botón mientras redirige.
- `.env` local con las credenciales reales (NO commiteado, gitignored).
- `.env.example` actualizado con la nueva nomenclatura de variables.

**No incluye**:

- **Onboarding** (elegir username + país tras primer login). Va en una propuesta separada `add-auth-onboarding` cuando exista mockup.
- **Páginas custom de Auth.js** (`pages.signIn`, `pages.error`). Por ahora se usan las built-in de Auth.js.
- **Account menu** (hamburguesa con avatar al estar logueado). Va en `add-account-menu`.
- **Middleware de protección de rutas privadas**. Las rutas privadas no existen todavía; el middleware se añade cuando aterricen `/dashboard`, `/account`, etc.
- **Email transaccional**, recuperación de contraseña, registro manual. Diferidos a fase 2 según `openspec/project.md`.

## Impact

- **Bloquea**: nada.
- **Desbloquea**: cualquier capability privada (dashboard, predicciones, cuenta, perfil propio en edición). El usuario ya puede iniciar sesión y obtener un `session` token que el resto del código puede leer con `await auth()`.
- **Riesgos**:
  - El `username` en `users` es **nullable** en el schema actual: Auth.js puede crear filas sin username. Hasta que aterrice `add-auth-onboarding`, los usuarios autenticados no pueden navegar a rutas privadas (pero la home pública sigue funcionando).
  - Sin la onboarding, su username es `NULL` y el perfil público en `/u/<username>` no existe para ellos.
  - **Las credenciales de OAuth viajaron en el chat** mientras se montaba esto. Recomendado rotarlas en la consola de Google antes del lanzamiento.

## Decisiones tomadas

- **Nomenclatura de env vars**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (la que Google muestra en su consola), no `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (la que Auth.js auto-detecta). Trade-off: hay que pasarlas explícitamente al `Google({ clientId, clientSecret })`. Beneficio: el nombre coincide 1:1 con lo que Google entrega y reduce confusión al copiar de un sitio a otro.
- **Session strategy**: `database` (las sesiones viven en la tabla `sessions` del schema). Esto da control fino (revocación, expiración) a costa de una query adicional por request. Para nuestro perfil de tráfico es asumible.
- **Callback URL post-login**: por ahora `"/"` (la home pública). Cuando exista el dashboard, cambiará a `"/dashboard"` o, mejor, a `"/account/setup"` si el usuario no tiene username.
- **Sin SessionProvider en el layout** todavía. El hook `useSession()` solo lo necesitan componentes que muestran info del usuario, y en esta iteración no hay ninguno. `signIn()` desde `next-auth/react` funciona sin SessionProvider porque solo dispara una redirección.
- **`AUTH_SECRET`**: se ha generado uno local con `openssl rand -base64 48`. El usuario debería rotarlo y poner uno propio antes de cualquier deploy real.
