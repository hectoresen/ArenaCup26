# add-faq

## Why

Las reglas del producto (sistema de puntuación, doble predicción, prórroga, racha, logros, eliminación de cuenta…) viven en `docs/scoring.md`, `docs/business-rules.md` y `docs/achievements.md`, pero hoy **no son visibles para el usuario**: solo están en el repo. Sin un FAQ, el visitante que se topa con "doble predicción" o "puntos provisionales" en la UI no tiene dónde resolver la duda.

Esta propuesta añade una página `/faq` con dos bloques (tabla de scoring + preguntas comunes) accesible desde el menú de cuenta y desde el modal de "Predecir ahora", siguiendo el lenguaje visual existente y traducida a los 4 locales.

## What changes

Capability nueva: **`faq`**.

- Página `src/app/[locale]/faq/page.tsx` (Server Component, i18n-aware) con:
  - `<TopChrome />` en las esquinas (LanguageSwitcher + AccountMenu/JoinCta).
  - Header con título "Preguntas frecuentes" + subtítulo.
  - Sección **Tabla de puntuación**: lista de filas con label + nota + valor en gold/warm/info según tipo (acierto, combo, engagement…).
  - Sección **Preguntas comunes**: 9 ítems Q&A en `<details>` nativo (accesible por defecto, chevron rota al abrir).
  - Botón gold "Volver al ranking" al final.
- Componente nuevo `src/components/layout/top-chrome.tsx` que extrae los slots top-start (LanguageSwitcher) y top-end (AccountMenu/JoinCta). Reusado por la home y la nueva FAQ.
- Componente nuevo `src/components/faq/scoring-table.tsx` para la tabla de puntos.
- Componente nuevo `src/components/faq/faq-item.tsx` para cada Q&A (envuelve `<details>` con estilos del brand).
- Link "Preguntas frecuentes" en el `<AccountMenu />` (entre la cabecera del usuario y "Cerrar sesión").
- Link discreto al pie del modal de `<JoinCta />`: "¿Cómo funciona? Lee las preguntas frecuentes →".
- Refactor de `<LeaderboardView />` para consumir `<TopChrome />` en lugar de duplicar los dos slots.
- Translations en los 4 locales para todo el contenido del FAQ.

**No incluye**:

- Búsqueda dentro del FAQ.
- Anchors profundos por pregunta (`/faq#double-prediction`).
- Sub-páginas (`/faq/scoring`, `/faq/account`). Por ahora todo en una sola página, navegable con scroll.

## Impact

- **Bloquea**: nada.
- **Desbloquea**: cuando aparezcan dudas frecuentes en el feedback de usuarios, se añaden ítems en `messages/*.json` sin tocar componentes.
- **Riesgos**:
  - Las traducciones largas son las primeras de su tamaño en el repo. Mantenerlas en sync entre los 4 idiomas requerirá disciplina (la spec de `add-i18n` ya documenta que cualquier clave nueva debe replicarse en los 4 archivos).
  - La sección árabe contiene texto extenso revisado por mí; recomendable que un nativo lo audite antes del lanzamiento.

## Decisiones tomadas

- **`<details>` nativo** en lugar de un componente accordion custom. Cero JavaScript, cero ARIA manual: el navegador maneja teclado, focus y toggle nativamente. La animación de la chevron se hace con CSS (`group-open:rotate-180`).
- **`<TopChrome />` reusable**: el slot top-start + top-end se duplicaba ya entre home y futuras páginas. Mejor extraerlo ahora.
- **Tabla de scoring antes de las preguntas**: la mayoría de dudas son "¿cuántos puntos vale X?". Verla primero responde el 70% sin necesidad de leer Q&A.
- **Link en JoinCta modal**: añadido por descubribilidad. Un visitante anónimo que aún no tiene clara la mecánica abre el modal y ve el enlace al FAQ antes de loguearse.
- **No anchors `#id` por ahora**: la página es lo bastante corta para que el scroll funcione. Cuando crezca, se añaden.
