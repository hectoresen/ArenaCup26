# Purpose

Sustituir el CTA "Predecir ahora" por un menú de cuenta cuando el usuario tiene sesión activa, ofreciendo de momento una única acción ("Cerrar sesión") y dejando la base lista para añadir más opciones a medida que aterricen capabilities privadas.

# Requirements

## Requirement 1: Visibilidad condicional según sesión

El slot `fixed top-right` muestra exactamente uno de dos componentes según el estado de autenticación.

### Scenario: Visitante anónimo

- **Given** un visitante sin cookie `next-auth.session-token` válida
- **When** carga la home `/`
- **Then** el slot top-right muestra el `<JoinCta />` con el botón "Predecir ahora".

### Scenario: Usuario autenticado

- **Given** un usuario con sesión activa (cookie válida y fila en `sessions`)
- **When** carga la home `/`
- **Then** el slot top-right muestra el `<AccountMenu />` con el avatar de Google (o iniciales si no hay imagen) y el icono de hamburguesa. El `<JoinCta />` no se renderiza.

## Requirement 2: Información del usuario en la cabecera del dropdown

Al abrir el menú, el usuario ve su nombre y email en la cabecera del dropdown.

### Scenario: Click en el trigger

- **Given** un usuario autenticado con `name = "Carlos Mendoza"` y `email = "carlos@gmail.com"`
- **When** hace click en el trigger del `AccountMenu`
- **Then** se despliega un panel debajo del trigger con dos líneas en la cabecera: "Carlos Mendoza" en gold + "carlos@gmail.com" en muted. Ambas truncadas con `text-overflow: ellipsis` si no caben.

### Scenario: Usuario sin nombre

- **Given** un usuario con `name = null` (caso edge)
- **When** abre el menú
- **Then** la cabecera muestra "Usuario" como fallback en lugar del nombre. El email se renderiza igual si está presente.

## Requirement 3: Cierre de sesión

El menú ofrece una opción "Cerrar sesión" que invalida la sesión y devuelve al usuario al estado anónimo.

### Scenario: Click en "Cerrar sesión"

- **Given** el menú abierto en una sesión autenticada
- **When** el usuario hace click en "Cerrar sesión"
- **Then** el botón queda deshabilitado, su label cambia a "Cerrando sesión…", se invoca `signOut({ callbackUrl: "/" })` desde `next-auth/react`, Auth.js elimina la fila correspondiente en `sessions` y limpia la cookie, y el navegador es redirigido a `/`. Al volver a renderizarse la página, el slot top-right vuelve a mostrar el `<JoinCta />`.

## Requirement 4: Cierre del dropdown sin acción

El dropdown se puede cerrar sin elegir ninguna opción de tres formas equivalentes.

### Scenario: Click fuera del menú

- **Given** el menú abierto
- **When** el usuario hace click en cualquier punto fuera del contenedor del menú
- **Then** el dropdown se cierra. El estado de la sesión no cambia.

### Scenario: Tecla Escape

- **Given** el menú abierto
- **When** el usuario pulsa Escape
- **Then** el dropdown se cierra y el foco vuelve al botón trigger.

### Scenario: Click en el trigger con menú abierto

- **Given** el menú abierto
- **When** el usuario hace click otra vez en el trigger
- **Then** el dropdown se cierra (toggle).

## Requirement 5: Avatar con fallback a iniciales

El trigger muestra el avatar del usuario cuando está disponible, e iniciales como respaldo.

### Scenario: User con `image`

- **Given** un usuario con `user.image` apuntando a una URL de Google
- **When** se renderiza el trigger
- **Then** el avatar es un `<img src={user.image}>` cuadrado redondeado de 28px. El `alt` es vacío porque el botón ya tiene `aria-label`.

### Scenario: User sin `image`

- **Given** un usuario con `user.image = null`
- **When** se renderiza el trigger
- **Then** el avatar es un círculo gold con las iniciales calculadas a partir del `name` (o del email si tampoco hay name), máximo 2 caracteres.

## Requirement 6: Accesibilidad

El menú cumple criterios mínimos de WAI-ARIA para menús desplegables.

### Scenario: Atributos ARIA del trigger

- **Given** el componente renderizado
- **When** un lector de pantalla lo recorre
- **Then** el trigger tiene `aria-haspopup="menu"` y `aria-expanded` reflejando el estado actual. El `aria-label` cambia entre "Abrir menú de cuenta" y "Cerrar menú de cuenta".

### Scenario: Atributos ARIA del dropdown

- **Given** el menú abierto
- **When** un lector de pantalla lo recorre
- **Then** el contenedor tiene `role="menu"` con `aria-label="Menú de cuenta"`, y cada acción dentro tiene `role="menuitem"`.

### Scenario: Movimiento reducido respetado

- **Given** un usuario con `prefers-reduced-motion: reduce` activado
- **When** abre el menú
- **Then** la animación `popIn` del dropdown tiene duración cero por la regla global definida en `globals.css`.
