"use client";

import { Link } from "@/i18n/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  username?: string | null;
};

/**
 * Si se pasa `trigger`, se usa como contenido del botón que abre el
 * menú (en lugar del avatar + hamburger por defecto). Los hooks de
 * estado, click-outside y escape siguen activos para que el dropdown
 * funcione exactamente igual. El shell aprovecha esto para mostrar el
 * `<AppAvatar>` con su ring conic dentro del top-nav.
 */
export function AccountMenu({
  user,
  trigger,
}: {
  user: SessionUser;
  trigger?: ReactNode;
}) {
  const t = useTranslations("accountMenu");
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      console.error("[arenacup26] sign-out error", error);
      setSigningOut(false);
    }
  }

  const fallbackInitials = (user.name ?? user.email ?? "??")
    .split(/[ @]/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? t("closeLabel") : t("openLabel")}
        className={
          trigger
            ? "flex cursor-pointer items-center rounded-full border-none bg-transparent p-0 transition-opacity hover:opacity-90"
            : "flex cursor-pointer items-center gap-2 rounded-full border-2 border-gold/30 bg-card/90 px-2 py-1.5 backdrop-blur transition-colors hover:border-gold/50 hover:bg-card-hover/90"
        }
      >
        {trigger ?? (
          <>
            <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-gold to-gold-deep font-display text-[11px] text-[#1a1000]">
              {user.image ? (
                <img src={user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                fallbackInitials
              )}
            </span>
            <svg className="h-3.5 w-4 text-foreground/80" viewBox="0 0 16 14" aria-hidden="true">
              <path
                d="M2 3 H14 M2 7 H14 M2 11 H14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("menuLabel")}
          className="absolute end-0 mt-2 w-64 origin-top-end overflow-hidden rounded-2xl border-2 border-gold/30 bg-gradient-to-br from-card-hover to-card text-foreground shadow-[0_24px_48px_rgba(0,0,0,0.5)] [animation:popIn_0.2s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
        >
          <div className="border-b border-border px-4 py-3 text-start">
            <div className="truncate font-display text-sm text-gold">
              {user.name ?? t("fallbackName")}
            </div>
            {user.email && (
              <div className="truncate text-[11px] font-bold text-muted">{user.email}</div>
            )}
          </div>

          {user.username && (
            <Link
              href={`/u/${user.username}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-start text-sm font-bold text-foreground transition-colors hover:bg-white/[0.05]"
            >
              <svg
                className="h-4 w-4 text-muted"
                viewBox="0 0 16 16"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="8" cy="6" r="3" />
                <path d="M2.5 14 a5.5 5.5 0 0 1 11 0" />
              </svg>
              {t("profile")}
            </Link>
          )}

          <Link
            href="/ajustes"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-start text-sm font-bold text-foreground transition-colors hover:bg-white/[0.05]"
          >
            <svg
              className="h-4 w-4 text-muted"
              viewBox="0 0 16 16"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="2.5" />
              <path d="M8 2 V4 M8 12 V14 M14 8 H12 M4 8 H2 M12.2 3.8 L10.8 5.2 M5.2 10.8 L3.8 12.2 M12.2 12.2 L10.8 10.8 M5.2 5.2 L3.8 3.8" />
            </svg>
            {t("settings")}
          </Link>

          <Link
            href="/historial"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-start text-sm font-bold text-foreground transition-colors hover:bg-white/[0.05]"
          >
            <svg
              className="h-4 w-4 text-muted"
              viewBox="0 0 16 16"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 4 a5.5 5.5 0 1 1 1.2 5.5" />
              <path d="M2 2 V5 H5" />
              <path d="M8 5 V8 L10.5 9.5" />
            </svg>
            {t("history")}
          </Link>

          {/* Amigos ya vive en la bottom-nav como "Social" — no
              duplicamos en el dropdown. Logros se mueve aquí porque
              dejó de tener pestaña propia (decisión QA 2026-05-18).
              El path /logros redirige server-side a /u/<username>
              con el ancla del acordeón. */}
          <Link
            href="/logros"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-start text-sm font-bold text-foreground transition-colors hover:bg-white/[0.05]"
          >
            <svg
              className="h-4 w-4 text-muted"
              viewBox="0 0 16 16"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 3 H11 V5.5 C11 8 9.5 9 8 9 C6.5 9 5 8 5 5.5 Z" />
              <path d="M5 4 H3 V5 C3 6.5 4 7 5 7 M11 4 H13 V5 C13 6.5 12 7 11 7" />
              <path d="M8 9 V11 M6 11 H10 V13 H6 Z" />
            </svg>
            {t("achievements")}
          </Link>

          {/* Ajustes (privacy + push + delete) ya tienen su propio
              link arriba ("Ajustes") hacia `/ajustes`. Antes vivían
              como acordeón en `/u/<username>`.
              El link "Mi perfil" arriba ya lleva al user a su
              página `/u/<username>` donde encuentra todo. */}

          <Link
            href="/faq"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-start text-sm font-bold text-foreground transition-colors hover:bg-white/[0.05]"
          >
            <svg
              className="h-4 w-4 text-muted"
              viewBox="0 0 16 16"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="6.5" />
              <path d="M6 6.5 a2 2 0 1 1 2.5 1.9 V10 M8 12.5 v0.5" />
            </svg>
            {t("faq")}
          </Link>

          <Link
            href="/legal/privacy"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-start text-[12px] font-bold text-muted transition-colors hover:bg-white/[0.05] hover:text-foreground"
          >
            <span aria-hidden="true" className="ms-7 inline-block">·</span>
            {t("legalPrivacy")}
          </Link>

          <Link
            href="/legal/terms"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-start text-[12px] font-bold text-muted transition-colors hover:bg-white/[0.05] hover:text-foreground"
          >
            <span aria-hidden="true" className="ms-7 inline-block">·</span>
            {t("legalTerms")}
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full cursor-pointer items-center gap-3 border-t border-border px-4 py-3 text-start text-sm font-bold text-foreground transition-colors hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60"
          >
            <svg
              className="h-4 w-4 text-muted"
              viewBox="0 0 16 16"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 H3 a1 1 0 0 0 -1 1 v10 a1 1 0 0 0 1 1 h3" />
              <path d="M11 5 L14 8 L11 11 M14 8 H7" />
            </svg>
            {signingOut ? t("signingOut") : t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
