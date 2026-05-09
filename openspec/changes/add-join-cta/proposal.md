# add-join-cta

## Why

La página `/` ya muestra el ranking en vivo, pero **no ofrece manera de entrar a la app**. El visitante ve el leaderboard como un escaparate y se queda mirando. Esta propuesta añade el primer enganche: un CTA "Predecir ahora" justo después del header que abre un modal centrado con un botón "Continuar con Google".

El handler real del OAuth queda para `add-auth-google`; aquí solo se materializa la superficie de UI.

## What changes

Capability nueva: **`auth-entry`** (entry surface to authentication).

- Componente `<JoinCta />` (Client) con el botón gold "Predecir ahora", la lógica de open/close y el `<dialog>` nativo embebido. El `<dialog>` contiene el botón "Continuar con Google" con el logo G oficial (stub: `onClick` no dispara nada).
- Posición del CTA: **fija en la esquina superior derecha del viewport** (`fixed top-3 right-3`, `sm:top-5 sm:right-5`, `z-30`) para que sea descubrible de un vistazo y no compita con el ruido visual del podio/lista.
- Cuando aterrice `add-auth-google`, este mismo slot top-right se ocupará por un menú de cuenta tipo hamburguesa (avatar + dropdown). El componente `JoinCta` se intercambia por `<AccountMenu />` en función del estado de sesión, sin tocar layout.
- El modal se cierra con X, click fuera o Escape (gracias a `<dialog>` nativo) y bloquea el scroll del body mientras está abierto.

**No incluye**:

- El flow real de Google OAuth (callbacks, sesión, redirect a onboarding). Eso es `add-auth-google`.
- Pantalla de onboarding (username, país). Va con `add-auth-google` o más adelante.
- Login con email/contraseña (diferido a fase 2 según `openspec/project.md`).
- Tests con React Testing Library (no está instalado todavía; se añade en una propuesta de tooling cuando sea necesario).

## Impact

- **Bloquea**: nada.
- **Desbloquea**: `add-auth-google` aterriza simplemente reemplazando el `onClick` stub del `GoogleSignInButton` por `signIn("google")`. Cero refactor de componentes.
- **Riesgos**:
  - El modal usa `z-50`; si después llegan toasts o notificaciones in-app, hay que coordinar z-indices.
  - El copy del CTA es una decisión de producto que puede revisarse con métricas reales.
- **Decisiones tomadas en esta propuesta**:
  - Copy del CTA: **"Predecir ahora"** (sugerencia del producto, dirección clara y verbo de acción).
  - Posición: **fija en la esquina superior derecha del viewport**. Iteración previa lo ponía centrado entre header y podio; se descartó porque competía con el ruido visual del ranking. Top-right es un patrón conocido para acciones primarias persistentes.
  - Estilo del CTA: pill gold sólido (gradiente `gold → gold-deep`) con icono de balón a la izquierda y flecha a la derecha. Padding y tipografía reducidos en mobile (`px-3 py-2 text-[11px]`) para no comerse el header del panel en pantallas estrechas.
  - Modal: card `max-w-[380px]`, animación `popIn` vía `dialog[open]`, backdrop con `bg-black/65 backdrop-blur-sm` aplicado a `dialog::backdrop`. El `<dialog>` nativo se encarga del focus trap, restauración de foco al cerrar y manejo de Escape sin librerías.
  - Texto del modal: hero icon con un círculo gold con "26" dentro, título "Únete al Mundial 26", subtítulo "Predice partidos, sube en el ranking y desbloquea logros.", footer pequeño "Auth en construcción" para que el placeholder sea explícito.
  - Slot de futuro reemplazo: el mismo contenedor `fixed top-right` aloja `<AccountMenu />` cuando el usuario está autenticado. La capability `auth-entry` define solo el caso "no autenticado"; el caso "autenticado" se aborda en una propuesta posterior (`add-account-menu`).
