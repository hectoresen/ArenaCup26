"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

export function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleSelect(next: Locale) {
    if (next === locale) {
      setOpen(false);
      return;
    }
    router.replace(pathname, { locale: next });
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("openLabel")}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-gold/30 bg-card/90 px-3 py-1.5 backdrop-blur transition-colors hover:border-gold/50 hover:bg-card-hover/90"
      >
        <svg
          className="h-3.5 w-3.5 text-muted"
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8" cy="8" r="6.5" />
          <path d="M1.5 8 H14.5 M8 1.5 C10 4 10 12 8 14.5 M8 1.5 C6 4 6 12 8 14.5" />
        </svg>
        <span className="font-display text-[11px] uppercase tracking-[0.12em] text-foreground sm:tracking-[0.14em]">
          <span className="sm:hidden">{locale.toUpperCase()}</span>
          <span className="hidden sm:inline">{t(`names.${locale}`)}</span>
        </span>
        <svg
          className="h-2.5 w-2.5 text-muted"
          viewBox="0 0 10 6"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 1 L5 5 L9 1" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t("label")}
          className="absolute start-0 mt-2 w-44 overflow-hidden rounded-xl border-2 border-gold/30 bg-gradient-to-br from-card-hover to-card text-foreground shadow-[0_16px_32px_rgba(0,0,0,0.5)] [animation:popIn_0.2s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
        >
          {routing.locales.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === locale}
                onClick={() => handleSelect(option)}
                className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-start text-sm font-bold transition-colors hover:bg-white/[0.05] ${
                  option === locale ? "text-gold" : "text-foreground"
                }`}
              >
                <span>{t(`names.${option}`)}</span>
                {option === locale && (
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8.5 L6.5 12 L13 4.5" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
