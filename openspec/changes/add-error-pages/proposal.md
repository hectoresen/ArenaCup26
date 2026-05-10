# add-error-pages

## Why

Hoy la app **no tiene páginas de error propias**. Si un usuario navega a una ruta que no existe (`/foo`), Next.js sirve su 404 por defecto — un fondo blanco con texto pequeño en negro, completamente fuera del lenguaje visual de WebMundial 26. Lo mismo con cualquier excepción no controlada en runtime.

Esta propuesta añade 404 y error.tsx con el mismo brand que el resto del producto y, ya que `add-i18n` está vivo, ambas páginas nacen multi-idioma.

## What changes

Capability nueva: **`error-pages`**.

- `<ErrorScreen />` — layout reusable: gran código en gold (Fredoka), título, descripción, slot de acciones. Sin `"use client"` para que sirva tanto en Server (`not-found.tsx`) como en Client (`error.tsx`).
- `src/app/[locale]/not-found.tsx` — Server Component, i18n-aware. Se invoca cuando `notFound()` es llamado o ninguna ruta hace match. Botón gold "Volver al inicio".
- `src/app/[locale]/error.tsx` — Client Component (lo exige Next por el callback `reset`). i18n-aware. Dos acciones: gold "Intentar de nuevo" (llama `reset()`) y secundaria "Volver al inicio" (Link a `/`).
- `src/app/global-error.tsx` — fallback catastrófico para errores que escapan al boundary de `[locale]` (errores en el layout raíz, en el provider de i18n, etc.). Inline styles, English-only, mínimo. Reemplaza el `<html>` entero.
- Las dos páginas de `[locale]` muestran el `<LanguageSwitcher />` en top-start y los `<FloatingBalls />` de fondo para mantener el lenguaje visual.
- Translations: namespace `errors` añadido en `messages/{es,en,fr,ar}.json` con sub-namespaces `notFound` y `runtime`.

**No incluye**:

- Página de `/api/auth/error` propia. Auth.js gestiona sus propios errores; cuando aterrice algo de UX específica de fallos de auth, se aborda separado.
- Logging server-side a un servicio externo (Sentry, Logtail, etc.). Por ahora `error.tsx` solo hace `console.error`.
- 500 page específica con stack trace en dev. Next 15 ya muestra un overlay útil en dev; nuestro `error.tsx` se usa en prod.

## Impact

- **Bloquea**: nada.
- **Desbloquea**: confianza de que cualquier página rota cae con dignidad. Ahora podemos construir cualquier propuesta posterior sin preocuparnos del 404.
- **Riesgos**:
  - Si el provider de i18n falla, las páginas de `[locale]` no podrán renderizar — para eso está `global-error.tsx`. Si ese también falla, el navegador muestra un error puro sin nuestro brand (aceptable).
  - El `<LanguageSwitcher />` en una 404 cambia el locale pero deja al usuario en la misma URL inválida (con prefix nuevo). Aceptable: en la nueva URL volverá a salir 404 (en el nuevo idioma) y desde ahí pulsa "Volver al inicio".

## Decisiones tomadas

- **Sin trofeo + "We Are 26" en las páginas de error**: la pantalla está enfocada en el error y la acción para resolverlo. Añadir el header completo distrae. El brand se mantiene vía paleta, fuentes, animaciones y el switcher en la esquina.
- **`global-error` en inglés y minimal**: cuando se renderiza es porque el provider de i18n no está disponible. Forzarlo a localizado sería frágil. Inglés es el común denominador internacional.
- **Sin AccountMenu en error pages**: requeriría `await auth()`, que no es trivial en `error.tsx` (Client). Mantener mínimas las páginas reduce ruido y acelera la recuperación cognitiva del usuario.
- **`code` traducible**: "404" se mantiene literal (es un código universal), pero "Oops" en runtime se localiza ("Oops" en es/en/fr, "Oops" en ar también — palabra adoptada universalmente). Si en alguna iteración el equipo prefiere algo más serio para árabe, se cambia en `messages/ar.json` sin tocar código.
