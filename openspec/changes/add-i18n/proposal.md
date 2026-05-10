# add-i18n

## Why

WebMundial 26 apunta a una audiencia global del Mundial. Hacer i18n **ahora**, con la base de UI todavía pequeña, ahorra el retrabajo masivo de extraer cientos de strings cuando el producto crezca. Cada componente futuro (predicciones, dashboard, FAQ, perfil) nacerá ya i18n-aware.

Idiomas elegidos:

- **es** (default — el equipo trabaja en español, contenido principal).
- **en** (alcance global).
- **fr** (Canadá francófono — uno de los anfitriones).
- **ar** (audiencia árabe del Mundial; introduce **RTL** que conviene resolver desde el principio).

## What changes

Capability nueva: **`i18n`**.

- Library: **`next-intl`** v3 (estándar para App Router, soporta RTL nativamente).
- Routing: `localePrefix: "as-needed"` → `/` (es, default, sin prefijo) y `/en/`, `/fr/`, `/ar/` para los demás.
- Detección del locale: middleware con `Accept-Language` como fallback la primera visita, cookie persistente de 1 año tras la primera elección.
- RTL: `<html dir="rtl">` cuando `locale === "ar"`. Refactor selectivo de Tailwind a logical properties (`end-` en lugar de `right-`, `text-end` en lugar de `text-right`) donde el sentido de lectura importa.
- Reestructuración: `src/app/{layout,page}.tsx` → `src/app/[locale]/{layout,page}.tsx`. La ruta `/api/auth/*` se queda donde está (rutas de API no llevan locale).
- Catálogo de mensajes en `messages/{es,en,fr,ar}.json` con todas las cadenas actuales del producto.
- Refactor de los componentes existentes para usar `useTranslations` / `getTranslations`:
  - `LeaderboardView` (header + footer).
  - `JoinCta` (botón + modal entero).
  - `AccountMenu` (trigger + dropdown).
  - `PodiumCard`, `RankRow` (labels y aria-labels).
- Componente `<LanguageSwitcher />` reusable, fijado en el **slot top-start del viewport** (top-left en LTR, top-right en RTL). Siempre visible — el visitante no necesita abrir ningún menú para cambiar de idioma. Mobile: muestra solo el código del locale (ES/EN/FR/AR) para no comerse el header; desktop: muestra el nombre nativo (Español/English/Français/العربية).

**No incluye**:

- Traducción de nombres de países en el mock (`countryName: "México"`). Se queda en español hasta que aterrice el seed real con todas las 48 naciones del Mundial; entonces se moverá a un namespace `countries.{code}` y se localizará a fondo.
- Polish RTL de animaciones direccionales (`slideIn` entra desde la izquierda en RTL también). Es un quirk visual menor; se mejora cuando merezca la pena con un `slideInRtl` paralelo.
- Format de fechas/números por locale más allá de lo trivial (los puntos siguen con separador de miles del default; se introducirá `Intl.NumberFormat` cuando aparezca un caso concreto).
- Internacionalización del esquema de BD ni de los datos persistidos. Solo UI.

## Impact

- **Bloquea**: todas las propuestas de UI futuras (deben nacer con claves de traducción, no strings hardcoded). Se documenta en `AGENTS.md`.
- **Desbloquea**: páginas de error i18n-aware (`add-error-pages`), FAQ multi-idioma (`add-faq`), y cualquier futura propuesta de UI.
- **Riesgos**:
  - El refactor toca casi todos los componentes existentes. Hay margen para introducir bugs sutiles (un aria-label mal interpolado, un fallback ausente). Compensado por el alcance reducido del producto en este momento.
  - Las traducciones a francés y árabe son las mejores que puedo entregar sin nativos. El árabe especialmente debería ser revisado por un hablante antes del lanzamiento; dejado documentado en `messages/ar.json` como nota.
  - `next-intl` añade overhead a SSR (cada request resuelve mensajes). Con un catálogo pequeño es despreciable; cuando el catálogo crezca, evaluar `getTranslations` con namespaces específicos para reducir bundle.

## Decisiones tomadas

- **`next-intl` v3 vs v4**: v3 es estable y compatible con Next 15.1 + React 19. v4 introduce cambios de API que aún están asentándose. Empezamos en v3; upgrade a v4 cuando madure como propuesta separada `update-i18n-v4`.
- **`localePrefix: "as-needed"`**: el default (es) sin prefijo, los demás con prefijo. Coincide con la convención SEO más común para sitios con un mercado primario claro y otros secundarios.
- **Cookie + Accept-Language**: cookie wins (preferencia explícita). Sin cookie, miramos `Accept-Language`. Sin coincidencia, default `es`.
- **Switcher fijo en top-start del viewport**, simétrico al slot top-end (CTA/AccountMenu). La iteración inicial lo embebía dentro del modal y del dropdown, pero era poco descubrible: un visitante árabe que aterriza en `/` (es por defecto) tenía que pulsar "Predecir ahora" para encontrar el switcher. Top-start lo hace siempre visible y respeta el patrón estándar (Wikipedia, sitios gubernamentales, etc.).
- **Sin localización del mock de jugadores** en esta iteración: pragmático. Cuando exista el seed real (`add-fixture-seed` o equivalente), las naciones se traducirán de verdad.
- **RTL: logical properties solo donde importa**: el slot top-right pasa a `top-end`, los `text-right`/`text-left` pasan a `text-end`/`text-start`. Centrados, paddings simétricos y márgenes neutros NO se tocan (Tailwind ya hace lo correcto).
