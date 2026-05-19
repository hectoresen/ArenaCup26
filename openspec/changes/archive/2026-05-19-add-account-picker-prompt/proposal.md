# add-account-picker-prompt

## Why

Tras cerrar sesión y volver a "Continuar con Google", el navegador
re-autentica con la última cuenta usada **sin mostrar el selector**.
Google mantiene la sesión a nivel de cookie del dominio
`accounts.google.com` y Auth.js no fuerza un prompt nuevo.

Problema concreto: si un user comparte el ordenador (familia, oficina)
o quiere probar la app con una segunda cuenta para tests, no puede
hacerlo sin entrar en `accounts.google.com` y cerrar la sesión de
Google manualmente. UX rota.

## What changes

`src/lib/auth.ts` — provider Google con `authorization.params.prompt`:

```ts
GoogleProvider({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  authorization: {
    params: {
      prompt: "select_account",
    },
  },
}),
```

Eso fuerza a Google a mostrar siempre el selector, incluso cuando el
user solo tiene una cuenta en el navegador.

Trade-offs documentados:
- **Ventaja**: control claro sobre qué cuenta entra; mejor para
  testing con múltiples emails; protege contra entradas accidentales
  con la cuenta equivocada en máquinas compartidas.
- **Coste UX**: 1 clic extra cada login (el del selector). Aceptable
  para el patrón de uso esperado (no es una app de uso minuto-a-minuto).

Alternativa considerada: `prompt: "consent"` re-pide los scopes en
cada login. Más invasivo y no resuelve el problema real. Descartada.

## Impact

- **Riesgo**: ninguno. Auth.js soporta `authorization.params` desde v4.
- **Bloquea**: nada.
- **Desbloquea**: pruebas multi-cuenta sin hacks de incógnito.

## Tests

- E2E (cuando aterrice `add-e2e-tests`): tras un login + logout, el
  segundo intento de login muestra la pantalla del selector de Google.
  Verificación visual; no se puede hacer assertion sin mockear el flow
  de OAuth.
