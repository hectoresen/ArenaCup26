# Design — add-i18n

## Estructura de archivos

```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx           ← raíz: <html lang dir> + NextIntlClientProvider
│   │   └── page.tsx             ← home (leaderboard)
│   ├── api/auth/[...nextauth]/route.ts   (sin locale, igual que antes)
│   └── globals.css              (sin cambios; importado desde [locale]/layout.tsx)
├── components/
│   ├── i18n/
│   │   └── language-switcher.tsx     (NUEVO, reusable)
│   ├── auth/account-menu.tsx         (refactor: useTranslations + LanguageSwitcher)
│   └── leaderboard/                  (refactor de todos)
├── i18n/
│   ├── routing.ts                    (define locales y prefix)
│   └── request.ts                    (carga messages JSON)
├── middleware.ts                     (NUEVO: createMiddleware del routing)
└── lib/...                           (sin cambios)

messages/
├── es.json
├── en.json
├── fr.json
└── ar.json
```

## Routing

```ts
// src/i18n/routing.ts
export const routing = defineRouting({
  locales: ["es", "en", "fr", "ar"],
  defaultLocale: "es",
  localePrefix: "as-needed",
});
```

URLs resultantes:

- `/` → es (sin prefijo, default)
- `/en/...` → en
- `/fr/...` → fr
- `/ar/...` → ar

API routes mantienen `/api/auth/*` sin tocar (el matcher del middleware las excluye).

## Detección de locale

El middleware sigue este orden:

1. Si la URL ya tiene prefijo (`/en`, `/fr`, `/ar`) → usa ese.
2. Si hay cookie `NEXT_LOCALE` → usa ese.
3. Si el header `Accept-Language` contiene un locale soportado → usa ese.
4. Fallback → `es` (default).

Cuando el usuario cambia de idioma vía `<LanguageSwitcher />`, `next-intl` actualiza la cookie `NEXT_LOCALE` y navega a la nueva URL prefixed.

## RTL

`<html dir="rtl">` cuando `locale === "ar"`. Esto hace que:

- Texto fluya derecha-izquierda automáticamente.
- Logical properties de Tailwind (`me-`, `ms-`, `text-end`, `text-start`, `start-`, `end-`) se invierten.
- Las animaciones físicas con `translateX(-N)` siguen entrando "desde la izquierda" — quirk menor, no se polishea en esta iteración.

Clases que se tocan (refactor):

- `right-3 top-3 sm:right-5 sm:top-5` → `end-3 top-3 sm:end-5 sm:top-5` (slot top-right).
- `right-0 mt-2` → `end-0 mt-2` (dropdown del AccountMenu, ancla a su trigger).
- `text-right` (footer del leaderboard) → `text-end`.
- `text-left` (header del dropdown) → `text-start`.
- `mr-1` / `ml-0.5` → `me-1` / `ms-0.5` cuando representan separación entre icono y texto.

## Catálogo de mensajes (namespaces)

Estructura JSON (igual en los 4 idiomas):

```json
{
  "metadata": { "title": "...", "description": "..." },
  "leaderboard": {
    "tagline": "...",
    "liveBadge": "...",
    "hostFlags": { "canada": "...", "mexico": "...", "usa": "..." },
    "footer": { "updatedNow": "...", "slogan": "WE ARE 26" },
    "row": { "noStreak": "...", "correctBadge": "✓ {count} ...", "ariaPosition": "...", "pts": "..." },
    "podium": { "pointsLabel": "..." }
  },
  "joinCta": {
    "button": "...",
    "modal": {
      "title": "...",
      "subtitle": "...",
      "googleButton": "...",
      "googlePending": "...",
      "footer": "...",
      "closeLabel": "..."
    }
  },
  "accountMenu": {
    "openLabel": "...",
    "closeLabel": "...",
    "menuLabel": "...",
    "fallbackName": "...",
    "signOut": "...",
    "signingOut": "..."
  },
  "languageSwitcher": {
    "label": "...",
    "es": "Español",
    "en": "English",
    "fr": "Français",
    "ar": "العربية"
  }
}
```

Strings de marca preservados (NO traducidos):

- "We Are" + "26" — logo identitario.
- "WE ARE 26" — slogan footer.
- "FIFA World Cup" — marca FIFA.
- Nombres de jugadores y países del mock — datos, no UI.

## Componente `<LanguageSwitcher />`

Botón compacto con bandera/iniciales del idioma actual. Click despliega los 4 idiomas en su nombre nativo (Español, English, Français, العربية). Al elegir, llama a `useRouter().replace(pathname, { locale: nuevo })` desde `next-intl`.

Embebido en:

- Footer del modal `JoinCta` (visitante anónimo).
- Final del dropdown `AccountMenu` (usuario autenticado).

Mismo lenguaje visual que el resto: card oscura, gold accents, Fredoka para el idioma seleccionado.

## Trade-offs

- **`next-intl` v3 vs v4**: v3 es estable, v4 cambia API. Empezamos en v3 para no perseguir cambios.
- **Mock de jugadores en español único**: se podría haber refactorizado todo a country-codes ya, pero eso obliga a crear el namespace `countries` con 48 naciones que luego cambiarán cuando llegue el seed real. Mejor diferirlo y mantener el mock estático.
- **No SessionProvider**: el `useTranslations` cliente funciona sin provider gracias a `<NextIntlClientProvider>`. La sesión sigue resuelta server-side; no hay regresión.
- **Pages de error sin i18n en este PR**: aún no hay `not-found.tsx` ni `error.tsx`. Los crearemos con i18n nativo en `add-error-pages` justo después de esta propuesta.
