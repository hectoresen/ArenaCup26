import type { Link } from "@/i18n/navigation";
import type { ComponentProps } from "react";

export type AppShellTab = {
  /** Path sin locale prefix (`/inicio`, `/partidos`, ...) */
  href: ComponentProps<typeof Link>["href"];
  /** Mensaje del label vía `useTranslations('appShell.tabs.*')` */
  labelKey: "home" | "matches" | "ranking" | "achievements";
  /** ID del símbolo SVG en el sprite (sin el `#`). */
  iconId: "ico-home" | "ico-ball" | "ico-trophy-sm" | "ico-medal";
};

/**
 * Definición compartida de los 4 tabs principales. La usan tanto el
 * top-nav (desktop) como el bottom-nav (móvil). Mantenerla aquí
 * garantiza que ambos navs nunca se desincronicen.
 */
export const APP_SHELL_TABS: readonly AppShellTab[] = [
  { href: "/inicio", labelKey: "home", iconId: "ico-home" },
  { href: "/partidos", labelKey: "matches", iconId: "ico-ball" },
  { href: "/ranking", labelKey: "ranking", iconId: "ico-trophy-sm" },
  { href: "/logros", labelKey: "achievements", iconId: "ico-medal" },
] as const;

/**
 * Decide si un pathname corresponde al tab dado. Match exacto y
 * además sub-rutas (`/partidos/123` activa el tab "Partidos"). Pure
 * function — testeable sin renderizar.
 */
export function isTabActive(pathname: string, tabHref: string): boolean {
  if (pathname === tabHref) return true;
  return pathname.startsWith(`${tabHref}/`);
}
