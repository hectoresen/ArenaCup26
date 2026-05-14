"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { APP_SHELL_TABS, isTabActive } from "./nav-tabs";

export function BottomNav() {
  const tTabs = useTranslations("appShell.tabs");
  const pathname = usePathname();

  return (
    <nav
      aria-label={tTabs("mobileLabel")}
      className="fixed inset-x-0 bottom-0 z-[100] hidden h-16 items-center justify-around border-t border-border bg-background/95 px-2 backdrop-blur-xl max-sm:flex"
    >
      {APP_SHELL_TABS.map((tab) => {
        const active = isTabActive(pathname, tab.href as string);
        return (
          <Link
            key={tab.href as string}
            href={tab.href}
            prefetch
            aria-current={active ? "page" : undefined}
            aria-label={tTabs(tab.labelKey)}
            className={`flex min-w-[52px] flex-col items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.04em] no-underline transition-colors ${
              active ? "text-gold" : "text-muted"
            }`}
          >
            <svg width="22" height="22" aria-hidden="true">
              <use href={`#${tab.iconId}`} />
            </svg>
            {tTabs(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
