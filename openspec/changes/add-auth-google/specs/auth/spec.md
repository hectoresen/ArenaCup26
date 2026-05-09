# Purpose

Permitir a un visitante de WebMundial 26 iniciar sesión con su cuenta de Google y obtener una sesión persistente en el servidor. Esta capability sienta la base de identidad para todas las superficies privadas (dashboard, predicciones, cuenta, perfil propio en edición).

# Requirements

## Requirement 1: Endpoint de inicio de sesión con Google

El sistema expone un endpoint que inicia el flow OAuth con Google.

### Scenario: Click en "Continuar con Google" desde el modal

- **Given** un visitante anónimo con el modal de `JoinCta` abierto
- **When** hace click en "Continuar con Google"
- **Then** el cliente invoca `signIn("google", { callbackUrl: "/" })`, se realiza un POST a `/api/auth/signin/google` con el CSRF token correspondiente, y el navegador es redirigido a la pantalla de consentimiento de Google.

### Scenario: Estado pendiente en el botón

- **Given** el botón Google clicado
- **When** la redirección está en curso
- **Then** el botón queda deshabilitado, su label cambia a "Redirigiendo…", y el cursor muestra `wait`.

## Requirement 2: Callback de Google crea o actualiza usuario

Cuando Google devuelve al usuario tras el consentimiento, el sistema crea o actualiza la fila de `users`, registra el provider en `accounts` y abre una sesión en `sessions`.

### Scenario: Primer login de un usuario

- **Given** un visitante que jamás ha entrado
- **When** completa el consentimiento y vuelve a `/api/auth/callback/google`
- **Then** se inserta una fila en `users` con `email`, `name`, `image`, `created_at`; el `username` permanece `NULL`. Se inserta una fila en `accounts` con `(provider="google", provider_account_id=...)`. Se inserta una fila en `sessions` y el navegador recibe la cookie `next-auth.session-token`.

### Scenario: Login de un usuario ya registrado

- **Given** un usuario con fila existente en `users` y `accounts`
- **When** vuelve a hacer login con Google
- **Then** no se duplica nada; se reutiliza el `user_id` existente, se inserta una nueva fila en `sessions` con un nuevo token, y la cookie del navegador se actualiza.

## Requirement 3: Cookie de sesión y consulta de la sesión

El sistema mantiene la sesión en una cookie HTTP-only y la expone vía endpoint y helper de servidor.

### Scenario: Lectura de sesión desde el servidor

- **Given** un usuario autenticado con cookie de sesión válida
- **When** una Server Component llama a `await auth()`
- **Then** recibe un objeto con `user.id`, `user.name`, `user.email`, `user.image` y la `expires` de la sesión.

### Scenario: Lectura de sesión sin auth

- **Given** un visitante anónimo
- **When** una Server Component llama a `await auth()`
- **Then** recibe `null`.

## Requirement 4: Logout

El usuario puede cerrar sesión.

### Scenario: Cierre de sesión

- **Given** un usuario autenticado
- **When** se invoca `signOut()` (cliente o server)
- **Then** se elimina la fila correspondiente en `sessions`, la cookie del navegador se limpia, y el siguiente `await auth()` devuelve `null`.

## Requirement 5: Configuración de variables de entorno

El sistema consume las credenciales de Google y el secret de Auth.js exclusivamente desde variables de entorno validadas con Zod.

### Scenario: Falta `AUTH_SECRET`

- **Given** el servidor arrancando
- **When** la variable `AUTH_SECRET` no está definida o tiene menos de 32 caracteres
- **Then** la validación de `src/lib/env.ts` falla con un mensaje específico y el proceso aborta antes de servir cualquier request.

### Scenario: Faltan credenciales de Google

- **Given** el servidor arrancando
- **When** `GOOGLE_CLIENT_ID` o `GOOGLE_CLIENT_SECRET` no están definidos
- **Then** la validación falla y el proceso aborta.

## Requirement 6: Segregación de fase 1

En la fase 1, el único provider habilitado es Google. No hay registro manual ni email transaccional.

### Scenario: Login por email/contraseña

- **Given** un visitante intenta acceder a un endpoint de credentials provider
- **When** la request llega
- **Then** Auth.js responde 404 / método no soportado, porque el provider `credentials` no está configurado en la fase 1.

## Requirement 7: Username diferido al onboarding

Tras el primer login, el usuario tiene `username = NULL`. La elección de username vive en una capability separada (`add-auth-onboarding`) y es prerrequisito para acceder a rutas privadas.

### Scenario: Usuario sin username intenta navegar a una ruta privada

- **Given** un usuario autenticado con `username = NULL`
- **When** intenta acceder a `/dashboard` (capability futura)
- **Then** el middleware (cuando exista) redirige a `/account/setup` para completar el onboarding.

> Nota: en esta capability, el middleware no existe todavía. Las rutas privadas tampoco. La regla queda documentada para cuando aterricen.
