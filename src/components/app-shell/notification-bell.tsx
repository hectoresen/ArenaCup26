"use client";

import { useTranslations } from "next-intl";

type Props = {
  unreadCount: number;
};

/**
 * Botón de notificaciones con badge. En esta capability solo se monta
 * el botón — el dropdown viene con `add-notifications`. Por ahora el
 * click no abre nada (futuros tests del dropdown lo conectarán).
 *
 * El badge se ocultó cuando `unreadCount = 0`. El conteo viaja por el
 * `aria-label` del botón (el badge visual va `aria-hidden`).
 */
export function NotificationBell({ unreadCount }: Props) {
  const t = useTranslations("appShell.bell");
  const label = unreadCount > 0 ? t("labelWithCount", { count: unreadCount }) : t("label");

  return (
    <button
      type="button"
      aria-label={label}
      className="relative cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
    >
      <svg width="20" height="20" aria-hidden="true">
        <use href="#ico-bell" />
      </svg>
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute end-[1px] top-[1px] inline-flex h-4 min-w-4 items-center justify-center rounded-full border-[1.5px] border-background bg-danger px-1 text-[9px] font-black leading-none text-white"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
