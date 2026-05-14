"use client";

import { Link } from "@/i18n/navigation";
import type { NotificationItem } from "@/server/notifications/types";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

type Props = {
  initialItems: NotificationItem[];
  initialUnreadCount: number;
  /** Server action que marca todo como leído. */
  onMarkAllRead: () => Promise<void>;
};

/**
 * Bell con dropdown. Muestra hasta 20 notificaciones, marca todas
 * como leídas al abrirse (UX agresiva pero clara: "ya las viste").
 *
 * No usa SSE — se pinta con el snapshot que llega por SSR. Al
 * pinchar una noti con `matchId`, navegamos al detalle del partido.
 */
export function NotificationBell({ initialItems, initialUnreadCount, onMarkAllRead }: Props) {
  const t = useTranslations("appShell.bell");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnreadCount);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [, startTransition] = useTransition();

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

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Optimistic update: el badge desaparece inmediatamente.
      setUnread(0);
      startTransition(() => {
        onMarkAllRead().catch(() => {
          // Si falla, repondemos el badge a su valor original.
          setUnread(initialUnreadCount);
        });
      });
    }
  }

  const label = unread > 0 ? t("labelWithCount", { count: unread }) : t("label");

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleOpen}
        className="relative cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
      >
        <svg width="20" height="20" aria-hidden="true">
          <use href="#ico-bell" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute end-[1px] top-[1px] inline-flex h-4 min-w-4 items-center justify-center rounded-full border-[1.5px] border-background bg-danger px-1 text-[9px] font-black leading-none text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("label")}
          className="absolute end-0 mt-2 w-[320px] origin-top-end overflow-hidden rounded-2xl border-2 border-gold/30 bg-gradient-to-br from-card-hover to-card text-foreground shadow-[0_24px_48px_rgba(0,0,0,0.5)] [animation:popIn_0.2s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
        >
          <header className="border-b border-border px-4 py-3">
            <div className="font-display text-sm text-gold">{t("dropdown.title")}</div>
          </header>
          {initialItems.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] font-bold text-muted">
              {t("dropdown.empty")}
            </p>
          ) : (
            <ul className="m-0 max-h-[60vh] list-none overflow-y-auto p-0">
              {initialItems.map((item) => (
                <NotificationRow key={item.id} item={item} onClose={() => setOpen(false)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  onClose,
}: {
  item: NotificationItem;
  onClose: () => void;
}) {
  const t = useTranslations("appShell.bell.dropdown.kind");
  const kindLabel = t(item.kind);
  const date = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
  const ago = formatAgo(date);

  const inner = (
    <>
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[0.06em] text-muted">
        <span>{kindLabel}</span>
        <span>{ago}</span>
      </div>
      <div className="text-[13px] font-extrabold text-foreground">{item.title}</div>
      {item.body && (
        <div className="mt-0.5 truncate text-[11px] font-bold text-muted">{item.body}</div>
      )}
    </>
  );

  const rowCls = `block border-b border-border/60 px-4 py-3 text-start transition-colors no-underline last:border-0 hover:bg-white/[0.05] ${
    item.readAt === null ? "bg-gold/[0.04]" : ""
  }`;

  if (item.matchId) {
    return (
      <li>
        <Link href={`/partidos/${item.matchId}` as never} onClick={onClose} className={rowCls}>
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <div className={rowCls}>{inner}</div>
    </li>
  );
}

/**
 * Formato relativo simple: "hace 3 m", "hace 2 h", "hace 4 d".
 * Pure function, deterministic.
 */
function formatAgo(date: Date, now: Date = new Date()): string {
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "ahora";
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} m`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  return `hace ${Math.floor(seconds / 86400)} d`;
}
