"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TrophyLogo } from "./icons";
import { APP_SHELL_TABS, isTabActive } from "./nav-tabs";

type Props = {
  /**
   * Slot a la derecha del nav. El shell lo rellena con el
   * `<NotificationBell />` y el menú de cuenta. Como slot abierto, no
   * impone al consumidor cómo se monta el avatar (puede ser un menú,
   * un Link a perfil, etc.).
   */
  trailing: ReactNode;
};

export function TopNav({ trailing }: Props) {
  const tBrand = useTranslations("appShell.brand");
  const tTabs = useTranslations("appShell.tabs");
  const tNav = useTranslations("appShell.nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={tNav("main")}
      className="fixed inset-x-0 top-0 z-[100] flex h-[60px] items-center gap-3 border-b border-border bg-background/90 px-5 backdrop-blur-xl"
    >
      <Link
        href="/inicio"
        aria-label={tBrand("logoAria")}
        className="flex flex-shrink-0 items-center gap-2 no-underline"
      >
        <TrophyLogo className="motion-safe:[animation:trophyFloat_3.5s_ease-in-out_infinite] [filter:drop-shadow(0_2px_8px_rgba(245,200,66,0.4))]" />
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg tracking-[-0.04em] text-gold">
            {tBrand("year")}
          </span>
          <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted">
            {tBrand("tag")}
          </span>
        </span>
      </Link>

      <div
        aria-label={tTabs("sectionsLabel")}
        className="hidden flex-1 items-center justify-center gap-1 sm:flex"
      >
        {APP_SHELL_TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href as string);
          return (
            <Link
              key={tab.href as string}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] px-3.5 py-1.5 text-[13px] font-extrabold no-underline transition-colors ${
                active
                  ? "border-gold/25 bg-gold/10 text-gold"
                  : "border-transparent text-muted hover:bg-white/[0.05] hover:text-foreground"
              }`}
            >
              <svg width="16" height="16" aria-hidden="true">
                <use href={`#${tab.iconId}`} />
              </svg>
              {tTabs(tab.labelKey)}
            </Link>
          );
        })}
      </div>

      <div className="ms-auto flex flex-shrink-0 items-center gap-2.5">{trailing}</div>
    </nav>
  );
}
