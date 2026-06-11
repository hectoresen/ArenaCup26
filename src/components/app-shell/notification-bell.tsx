"use client";

import { Link } from "@/i18n/navigation";
import { resolveNotificationHref } from "@/server/notifications/href";
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
 * Polling cada 60s a `/api/notifications/poll` para detectar
 * broadcasts y otros eventos asíncronos sin requerir F5. El polling
 * pausa cuando la pestaña está oculta (`document.hidden`) para no
 * gastar batería ni quota de BD.
 */
const POLL_INTERVAL_MS = 60_000;

/**
 * Threshold a partir del cual el body se considera "largo" y la fila
 * abre un modal con el mensaje completo en lugar de truncar con
 * ellipsis. ~80 chars caben en 2 líneas con el font/ancho actuales;
 * por encima de eso la `truncate` corta demasiado y el user no lee
 * el contenido entero.
 */
const LONG_BODY_THRESHOLD = 80;

function isLongBody(body: string | null | undefined): boolean {
  if (!body) return false;
  return body.length > LONG_BODY_THRESHOLD || body.includes("\n");
}

export function NotificationBell({ initialItems, initialUnreadCount, onMarkAllRead }: Props) {
  const t = useTranslations("appShell.bell");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnreadCount);
  const [expanded, setExpanded] = useState<NotificationItem | null>(null);
  const [items, setItems] = useState(initialItems);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/notifications/poll", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          items: NotificationItem[];
          unreadCount: number;
        };
        if (cancelled) return;
        setItems(data.items);
        // Si el dropdown está abierto, las nuevas se consideran "vistas"
        // implícitamente la próxima vez que se cierre/abra. Mantenemos
        // unread=0 mientras open=true para no parpadear el badge.
        setUnread((prev) => (open ? prev : data.unreadCount));
      } catch {
        // Network error transitorio — ignoramos y reintentamos el
        // siguiente tick. No tiene sentido mostrar error al user por
        // un poll de background.
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS);
    function onVisibility() {
      if (!document.hidden) void poll();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open]);

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
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] font-bold text-muted">
              {t("dropdown.empty")}
            </p>
          ) : (
            <ul className="m-0 max-h-[60vh] list-none overflow-y-auto p-0">
              {items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onClose={() => setOpen(false)}
                  onExpand={() => {
                    setOpen(false);
                    setExpanded(item);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
      {expanded && <NotificationModal item={expanded} onClose={() => setExpanded(null)} />}
    </div>
  );
}

function NotificationRow({
  item,
  onClose,
  onExpand,
}: {
  item: NotificationItem;
  onClose: () => void;
  onExpand: () => void;
}) {
  const t = useTranslations("appShell.bell.dropdown.kind");
  const tb = useTranslations("appShell.bell.dropdown");
  const kindLabel = t(item.kind);
  const date = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
  const ago = formatAgo(date);
  const long = isLongBody(item.body);

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
      {long && (
        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-gold/80">
          {tb("readMore")} →
        </div>
      )}
    </>
  );

  const rowCls = `block w-full border-b border-border/60 px-4 py-3 text-start transition-colors no-underline last:border-0 hover:bg-white/[0.05] ${
    item.readAt === null ? "bg-gold/[0.04]" : ""
  }`;

  const href = resolveNotificationHref(item);

  // Prioridad: si el body es largo y NO hay href, abrir modal.
  // Si hay href Y body largo, ofrecemos el modal (más útil que
  // navegar a /social cuando el contenido del aviso vive aquí).
  if (long) {
    return (
      <li>
        <button type="button" onClick={onExpand} className={`cursor-pointer ${rowCls}`}>
          {inner}
        </button>
      </li>
    );
  }

  if (href) {
    return (
      <li>
        <Link href={href as never} onClick={onClose} className={rowCls}>
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
 * Modal accesible que muestra title + body completo de una
 * notificación cuando el body es largo. Esc o click fuera cierra.
 * Sin librería externa — overlay simple, focus al botón cerrar.
 */
function NotificationModal({
  item,
  onClose,
}: {
  item: NotificationItem;
  onClose: () => void;
}) {
  const tb = useTranslations("appShell.bell.dropdown");
  const tk = useTranslations("appShell.bell.dropdown.kind");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const date = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
  const ago = formatAgo(date);

  return (
    <div
      // biome-ignore lint/a11y/useSemanticElements: <dialog> nativo requiere .showModal() imperativo; usamos overlay manual con role=dialog para control del CSS/animaciones
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-modal-title"
      className="fixed inset-0 z-[80] grid place-items-center px-4 py-8"
    >
      <button
        type="button"
        aria-label={tb("modalCloseAria")}
        onClick={onClose}
        className="absolute inset-0 cursor-pointer border-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl border-2 border-gold/30 bg-card text-foreground shadow-[0_24px_48px_rgba(0,0,0,0.6)] [animation:popIn_0.2s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.06em] text-muted">
              <span>{tk(item.kind)}</span>
              <span aria-hidden>·</span>
              <span>{ago}</span>
            </div>
            <h2 id="notif-modal-title" className="font-display text-base text-gold">
              {item.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={tb("modalCloseAria")}
            className="-mt-1 cursor-pointer rounded-md border border-border bg-card-hover px-2 py-1 text-[13px] font-black text-muted transition-colors hover:border-gold/40 hover:text-foreground"
          >
            ×
          </button>
        </header>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
            {item.body}
          </p>
        </div>
      </div>
    </div>
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
