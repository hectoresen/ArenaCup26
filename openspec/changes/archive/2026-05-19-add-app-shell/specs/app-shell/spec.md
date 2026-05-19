# Purpose

Definir la envoltura común (top-nav fijo + bottom-nav móvil + avatar + bell) que llevan todas las páginas del área logada del usuario. La landing pública (`/`) no la usa.

# Requirements

## Requirement 1: Route group `(app)` con guard de sesión

El layout del route group rechaza cualquier acceso sin sesión.

### Scenario: usuario sin sesión accede a `/inicio`

- **Given** un usuario sin cookie de sesión válida
- **When** navega a `/es/inicio`
- **Then** el server redirige `307` a `/es`.

### Scenario: usuario con sesión accede a `/inicio`

- **Given** una sesión válida
- **When** carga `/es/inicio`
- **Then** se renderiza el `<AppShell>` envolviendo `children` y el código de la página.

## Requirement 2: Top-nav fijo con tabs

El top-nav contiene logo, 4 tabs, bell y avatar. Es fixed en la cabecera.

### Scenario: el tab activo se marca por pathname

- **Given** el usuario en `/es/partidos`
- **When** se renderiza el `<TopNav>`
- **Then** el tab `Partidos` lleva `aria-current="page"` y la clase visual `active`; los otros tres no.

### Scenario: los enlaces respetan el locale activo

- **Given** locale `fr`
- **When** se renderiza el `<TopNav>`
- **Then** los `href` de los tabs son `/fr/inicio`, `/fr/partidos`, `/fr/ranking`, `/fr/logros`.

### Scenario: el top-nav se oculta debajo de 640 px

- **Given** un viewport `< 640px`
- **When** se renderiza el shell
- **Then** los `nav-tabs` quedan `display: none` y el `BottomNav` toma el control.

## Requirement 3: Bottom-nav móvil

El bottom-nav espeja los 4 tabs en pantallas pequeñas.

### Scenario: visibilidad

- **Given** viewport `< 640px`
- **When** el shell renderiza
- **Then** el `BottomNav` es `display: flex`; en viewports `>= 640px` queda oculto.

### Scenario: tabs consistentes con el top-nav

- **Given** los tabs del top-nav
- **When** se compara con los del bottom-nav
- **Then** ambos tienen los mismos `href` y el mismo tab marca el activo.

## Requirement 4: Avatar con ring gradiente

`<AppAvatar>` muestra la foto del provider o iniciales del nombre.

### Scenario: usuario con `image`

- **Given** `user = { name: "Carlos Mendoza", image: "https://..." }`
- **When** se renderiza
- **Then** muestra `<img src="https://..." />` dentro del ring gradiente.

### Scenario: usuario sin `image`

- **Given** `user = { name: "Carlos Mendoza", image: null }`
- **When** se renderiza
- **Then** muestra el texto `"CM"` (primera letra de cada palabra del nombre, máximo 2 letras).

### Scenario: usuario con un solo nombre

- **Given** `user = { name: "Layla", image: null }`
- **When** se renderiza
- **Then** muestra `"L"`.

### Scenario: aria-label

- **Given** `user.name = "Carlos Mendoza"`
- **When** se renderiza
- **Then** el contenedor tiene `aria-label="Avatar de Carlos Mendoza"` (i18n).

## Requirement 5: Notification bell con badge

`<NotificationBell>` muestra un badge numérico cuando hay no leídos.

### Scenario: sin notificaciones sin leer

- **Given** `unreadCount = 0`
- **When** se renderiza
- **Then** no aparece el badge.

### Scenario: con notificaciones sin leer

- **Given** `unreadCount = 3`
- **When** se renderiza
- **Then** aparece el badge con el texto `"3"` y `aria-label="Notificaciones — 3 sin leer"`.

### Scenario: aria-live para a11y

- **Given** el bell renderizado
- **When** se inspecciona el DOM
- **Then** el badge tiene `aria-hidden="true"` y el conteo viaja por el `aria-label` del botón.

## Requirement 6: Mensajes i18n

Los textos del shell viven en mensajes de `next-intl`, no hardcoded.

### Scenario: cuatro locales soportados

- **Given** locales `es`, `en`, `fr`, `ar`
- **When** se carga el shell
- **Then** los textos `appShell.tabs.{home,matches,ranking,achievements}` están traducidos en los cuatro JSON.

### Scenario: dirección RTL en árabe

- **Given** locale `ar`
- **When** se renderiza el shell
- **Then** los iconos de los tabs respetan la dirección lógica (`flex-row` natural; las clases `start-/end-` aplican).
