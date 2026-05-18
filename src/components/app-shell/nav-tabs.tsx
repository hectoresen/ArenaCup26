import type { Link } from "@/i18n/navigation";
import type { ComponentProps } from "react";

export type AppShellTab = {
  /** Path sin locale prefix (`/inicio`, `/partidos`, ...) */
  href: ComponentProps<typeof Link>["href"];
  /** Mensaje del label vía `useTranslations('appShell.tabs.*')` */
  labelKey: "home" | "matches" | "ranking" | "social";
  /** ID del símbolo SVG en el sprite (sin el `#`). */
  iconId: "ico-home" | "ico-ball" | "ico-trophy-sm" | "ico-social";
};

/**
 * Definición compartida de los 4 tabs principales. La usan tanto el
 * top-nav (desktop) como el bottom-nav (móvil). Mantenerla aquí
 * garantiza que ambos navs nunca se desincronicen.
 *
 * 2026-05-18: el tab "Logros" se retira porque ya están visibles en
 * el perfil propio + duplicaban valor; se reemplaza por "Social"
 * (amigos + invitaciones, con room para grupos/ligas en el futuro).
 * El link de logros vive ahora en el dropdown del avatar.
 */
export const APP_SHELL_TABS: readonly AppShellTab[] = [
  { href: "/inicio", labelKey: "home", iconId: "ico-home" },
  { href: "/partidos", labelKey: "matches", iconId: "ico-ball" },
  { href: "/ranking", labelKey: "ranking", iconId: "ico-trophy-sm" },
  { href: "/social", labelKey: "social", iconId: "ico-social" },
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
