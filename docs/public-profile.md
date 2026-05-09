# Perfil público

> Estado: scope cerrado (2026-05-06). Detalles de implementación se cierran en la propuesta `add-public-profile`. Referencia visual: [`public-profile-reference.html`](public-profile-reference.html).

Cada usuario tiene **un perfil público** accesible por enlace, sin necesidad de estar registrado para verlo.

## URL

Patrón a decidir en propuesta:

- `/u/<username>` — humano y compartible. Requiere reservar un username único en el registro.
- `/u/<user-id>` — más simple, sin colisiones, pero feo.

Recomendado: `/u/<username>` con fallback a id si el username aún no se ha definido.

## Contenido visible

- **Identidad** (sección hero, centrada):
  - Avatar (Google profile picture) con anillo dorado decorativo y, opcionalmente, indicador de actividad (decisión pendiente, ver más abajo).
  - Nombre público.
  - Handle `@username`.
  - Pill con bandera de país (opcional, elegida en onboarding).
  - Botón "Copiar enlace al perfil".
- **Stats básicas** (dos cards lado a lado):
  - Posición actual en el ranking global con subtítulo "de N jugadores".
  - Puntos oficiales acumulados con delta semanal.
- **Catálogo de logros** (24, ver `docs/achievements.md`):
  - Encapsulado en un **acordeón colapsable** que muestra "X de 24 desbloqueados" + mini-progress en el trigger. El usuario decide si lo abre.
  - Una vez abierto: barra de progreso completa + secciones por tier (común, poco común, épico, legendario, mítico, GOAT).
  - Logros desbloqueados con tier y check verde; pendientes (locked) en greyscale con lock icon.
  - En tiers legendario+ aparece chip de compartir al hover.

## Lo que NO se muestra

- Email, datos de contacto, IPs, sesiones.
- Predicciones específicas pasadas (los "picks" del usuario en cada partido). Decisión deliberada: evita copiar estrategias y reduce ruido legal.
- Stats detalladas (aciertos simples/exactos por separado, mejor racha, hitos individuales) — fuera de scope en fase 1.
- Trayectoria/timeline de actividad reciente — fuera de scope en fase 1.

## Compartir

- Botón "Copiar enlace" en el perfil → copia la URL al clipboard.
- En cards de logros tier legendario+, el `share-chip` enlaza al perfil público del usuario con anchor en ese logro (`/u/<username>#ach-<id>`).
- No hay integración con redes sociales en fase 1 (sin Open Graph cards específicas), pero la URL debe ser indexable y llevar `<meta>` básicos para preview limpio.

## Privacidad

- El perfil es **siempre público** mientras la cuenta esté activa. No hay opción "ocultar" en fase 1.
- Si el usuario elimina su cuenta, el perfil desaparece (RGPD).
- La cuenta solo expone lo definido arriba; ningún dato derivable a partir de ahí debe filtrarse.

## Decisiones pendientes (a cerrar en `add-public-profile`)

- Patrón de URL definitivo (`/u/<username>` vs `/u/<id>`).
- Si reservamos un `username` único en el onboarding o lo derivamos del email/Google name.
- Comportamiento si el username colisiona con rutas reservadas (`/u/api`, `/u/admin`, etc.).
- SEO: `<meta>` tags y robots. ¿Indexar perfiles? Probablemente sí, mejora descubrimiento.
## Decisiones cerradas (2026-05-07)

- **Indicador del avatar — "Activo hoy"**: punto verde con `pulse` si el usuario ha tenido cualquier evento (login, predicción, edición de predicción) en las últimas **24 h**. En caso contrario, gris o sin pulse. Requiere un campo `last_active_at` en la tabla `users` actualizado en cada interacción significativa.
- **Estado por defecto del acordeón de logros**: **cerrado**. Tanto en perfiles propios como ajenos. El visitante decide si abre el catálogo. Render inicial más rápido y compacto en móvil.
