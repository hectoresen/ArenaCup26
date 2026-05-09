# Purpose

Ofrecer al visitante anónimo de la página pública (`/`) un punto de entrada visible y persistente para iniciar sesión y empezar a participar en WebMundial 26. Esta capability sirve solo como superficie de UI y delega el flow real de autenticación en `add-auth-google`.

# Requirements

## Requirement 1: CTA persistente en la esquina superior derecha

Mientras el visitante esté **no autenticado**, la página `/` muestra un botón fijo en la esquina superior derecha del viewport invitando a empezar a predecir.

### Scenario: Render del CTA en visitante anónimo

- **Given** un visitante sin sesión activa accede a `/`
- **When** se renderiza la página
- **Then** aparece, fijado en la esquina superior derecha del viewport, un botón gold con la copia "Predecir ahora" precedido por un balón y seguido de una flecha. El botón sigue visible aunque el usuario haga scroll.

### Scenario: Padding adaptado a móvil

- **Given** la página `/` cargada en un viewport de ancho ≤ 640px
- **When** se renderiza el CTA
- **Then** el botón usa padding y tipografía reducidos para no invadir el header del panel; las clases responsive `sm:` aplican a partir de 640px con la versión completa.

### Scenario: Hueco reservado para el menú de cuenta autenticado

- **Given** un usuario autenticado (caso futuro de `add-account-menu`)
- **When** acceda a `/`
- **Then** el slot top-right ocupa exactamente el mismo espacio pero con un menú de cuenta (avatar + hamburguesa) en lugar del CTA. Esta capability garantiza que la posición y el `z-index` no entren en conflicto con futuros ocupantes del slot.

## Requirement 2: Modal de auth al click

El click en el CTA abre un modal centrado por encima del leaderboard.

### Scenario: Click abre el modal

- **Given** el CTA visible
- **When** el visitante hace click
- **Then** se invoca `dialog.showModal()` y aparece, centrado en el viewport, un `<dialog>` con: hero icon dorado con "26", título "Únete al Mundial 26", subtítulo descriptivo, un botón "Continuar con Google" con el logo G oficial, y un texto pequeño "Auth en construcción".

### Scenario: Backdrop bloquea el contenido detrás

- **Given** el modal abierto
- **When** está visible
- **Then** el `dialog::backdrop` aplica `bg-black/65` con `backdrop-blur-sm`, y el navegador (vía `<dialog>` nativo) impide la interacción con el contenido detrás.

## Requirement 3: Cierre del modal

El visitante puede cerrar el modal de tres formas equivalentes.

### Scenario: Cierre con la X

- **Given** el modal abierto
- **When** el visitante hace click en el botón con icono X arriba a la derecha
- **Then** se llama a `dialog.close()` y el modal se cierra; el foco regresa automáticamente al CTA gracias al manejo nativo de `<dialog>`.

### Scenario: Cierre con click fuera

- **Given** el modal abierto
- **When** el visitante hace click sobre el backdrop
- **Then** el handler `onClick` del `<dialog>` detecta `event.target === dialogRef.current` y llama a `close()`.

### Scenario: Cierre con Escape

- **Given** el modal abierto
- **When** el visitante pulsa la tecla Escape
- **Then** el navegador cierra el `<dialog>` automáticamente.

## Requirement 4: Botón Google es un stub

El botón "Continuar con Google" no inicia el flow OAuth real en esta capability.

### Scenario: Click sobre el botón Google

- **Given** el modal abierto
- **When** el visitante hace click en "Continuar con Google"
- **Then** el handler invoca `console.info` con un mensaje placeholder y nada más ocurre. El handler real se conectará en `add-auth-google` reemplazando el stub por `signIn("google")`.

### Scenario: Indicador visual del estado placeholder

- **Given** el modal abierto
- **When** el visitante lee el contenido
- **Then** ve un texto en pequeño debajo del botón Google: "Auth en construcción", para no inducir a confusión sobre el estado real del flow.

## Requirement 5: Accesibilidad

El modal cumple criterios mínimos de accesibilidad de diálogos.

### Scenario: Atributos ARIA

- **Given** el modal abierto
- **When** un lector de pantalla lo recorre
- **Then** el `<dialog>` está etiquetado por `aria-labelledby` apuntando al `id` del título, y el `<dialog>` nativo se anuncia como diálogo por defecto sin necesidad de `role="dialog"`.

### Scenario: Movimiento reducido respetado

- **Given** un usuario con `prefers-reduced-motion: reduce` activado
- **When** abre el modal
- **Then** la animación de entrada (`popIn`) tiene duración cero gracias a la regla global declarada en `globals.css`.
