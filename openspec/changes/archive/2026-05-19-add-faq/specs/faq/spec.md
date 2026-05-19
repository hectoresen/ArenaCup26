# Purpose

Servir una página `/faq` accesible desde el menú de cuenta y desde el modal de "Predecir ahora" que explique la tabla de puntuación y las dudas más comunes (doble predicción, ventana de predicción, eliminatoria, puntos provisionales, racha, logros, username, eliminación de cuenta). Siempre en el idioma del usuario y con el lenguaje visual del producto.

# Requirements

## Requirement 1: Página accesible vía locale

`/faq` (default es) y `/{locale}/faq` están disponibles, con todo el contenido localizado.

### Scenario: Visitante en árabe

- **Given** un visitante con `NEXT_LOCALE=ar`
- **When** navega a `/ar/faq`
- **Then** la página se renderiza con `<html lang="ar" dir="rtl">`, el título "الأسئلة الشائعة", la tabla de scoring traducida y los 9 ítems Q&A en árabe.

## Requirement 2: Tabla de puntuación visible

La página muestra una tabla con todas las acciones que otorgan o no otorgan puntos.

### Scenario: Render de la tabla

- **Given** la página `/faq` cargada
- **When** el usuario observa la primera sección
- **Then** ve "Tabla de puntuación" como título y 10 filas: acierto simple (+10), acierto exacto (+30), doble acertada (+5), falla (0), combo base (+5/+15/+50), combo modificado con dobles (+3/+5/+9), encuesta participar (+1), encuesta acertar (+1), referido acierta (+10), login diario (0). Cada fila lleva una nota explicativa.

### Scenario: Tones diferenciados por tipo

- **Given** la tabla renderizada
- **When** el usuario observa los valores
- **Then** las filas que otorgan puntos por aciertos usan accent y valor en gold; las de combo usan warm; las de engagement (encuesta, referido) usan info; las de 0 puntos usan neutral.

## Requirement 3: Acordeones de preguntas comunes

Tras la tabla, hay 9 ítems Q&A colapsables.

### Scenario: Click en una pregunta

- **Given** un ítem cerrado
- **When** el usuario hace click sobre la pregunta
- **Then** el `<details>` nativo se abre, el chevron rota 180°, y aparece la respuesta. Click otra vez cierra. La accesibilidad por teclado (Enter, Space) funciona porque viene gratis del elemento nativo.

### Scenario: Múltiples ítems abiertos a la vez

- **Given** dos ítems abiertos
- **When** el usuario hace click en un tercero
- **Then** el tercero se abre sin cerrar los otros (los `<details>` no son mutuamente excluyentes).

## Requirement 4: Acceso desde el AccountMenu

Cuando el usuario está autenticado, su menú incluye un acceso al FAQ.

### Scenario: Item visible en el dropdown

- **Given** un usuario logueado en cualquier ruta con el AccountMenu abierto
- **When** observa el dropdown
- **Then** ve "Preguntas frecuentes" entre la cabecera (nombre + email) y "Cerrar sesión", con un icono `?` informativo.

### Scenario: Click navega y cierra el menú

- **Given** el item visible
- **When** hace click
- **Then** se navega a `/{locale}/faq` y el dropdown se cierra automáticamente (el `onClick` invoca `setOpen(false)` y el Link de `@/i18n/navigation` realiza la navegación).

## Requirement 5: Acceso desde el JoinCta modal

Visitantes anónimos también pueden llegar al FAQ sin loguearse.

### Scenario: Link en el modal

- **Given** un visitante anónimo con el modal de "Predecir ahora" abierto
- **When** observa el final del modal
- **Then** ve un texto pequeño con underline "¿Cómo funciona? Lee las preguntas frecuentes →".

### Scenario: Click cierra el modal y navega

- **Given** el link visible
- **When** hace click
- **Then** el dialog se cierra y se navega a `/{locale}/faq`.

## Requirement 6: TopChrome consistente

La página `/faq` muestra los mismos slots de cabecera que la home.

### Scenario: Slots top-start y top-end

- **Given** la página `/faq` renderizada
- **When** el usuario observa las esquinas superiores
- **Then** ve el `<LanguageSwitcher />` en top-start y, en top-end, `<AccountMenu />` si hay sesión o `<JoinCta />` en caso contrario. RTL los mirror automáticamente.

## Requirement 7: Sincronización de claves entre locales

Cualquier clave nueva en `messages/es.json` namespace `faq` debe replicarse en los otros tres archivos.

### Scenario: Clave faltante en un locale

- **Given** un developer añade `faq.questions.items.someNew.q/a` en `es.json` y olvida hacerlo en `ar.json`
- **When** un visitante en árabe carga `/ar/faq`
- **Then** `next-intl` lanza un error de runtime en el log y la UI muestra el código de la clave en lugar del texto. La política existente de `add-i18n` cubre este caso; la propuesta solo añade volumen.
