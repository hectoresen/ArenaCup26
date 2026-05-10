import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en", "fr", "ar"] as const,
  defaultLocale: "es",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

/**
 * Type-guard local. Sustituye a `hasLocale` de next-intl para
 * compatibilidad con cualquier 3.x sin depender de la versión.
 */
export function isValidLocale(value: string | undefined | null): value is Locale {
  if (!value) return false;
  return (routing.locales as readonly string[]).includes(value);
}
