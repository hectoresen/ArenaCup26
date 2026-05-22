"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  description: string;
  badge?: string;
};

/**
 * Estructura de navegación del admin. Agrupada por categoría para
 * que el sidebar siga teniendo sentido cuando entren las acciones
 * de Fase 2 y 3. Cada item se renderiza con su icono SVG inline
 * para no añadir dependencias.
 */
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Visión",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: "home",
        description: "Métricas y actividad reciente",
      },
    ],
  },
  {
    title: "Comunidad",
    items: [
      {
        href: "/admin/users",
        label: "Usuarios",
        icon: "users",
        description: "Listado + detalle de usuarios",
      },
    ],
  },
  {
    title: "Comunicación",
    items: [
      {
        href: "/admin/broadcast",
        label: "Broadcast",
        icon: "megaphone",
        description: "Notificación a todos los humanos",
      },
    ],
  },
  {
    title: "Operaciones",
    items: [
      {
        href: "/admin/maintenance",
        label: "Mantenimiento",
        icon: "wrench",
        description: "Toggle modo mantenimiento global",
      },
      {
        href: "/admin/backups",
        label: "Backups",
        icon: "database",
        description: "Listado de snapshots BD",
      },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Shell del panel admin: header con identidad + email + signout,
 * sidebar lateral en desktop (≥lg), drawer en mobile, breadcrumb
 * superior con "Volver" cuando estamos en sub-páginas.
 *
 * Es Client Component para `usePathname` y para el drawer toggle.
 * El auth check ya vive en el server layout padre, así que aquí
 * solo manejamos UI.
 */
export function AdminShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Match activo: el item del path actual o el más específico
  // que sea prefijo (e.g. `/admin/users/123` matchea `/admin/users`).
  const activeItem =
    ALL_ITEMS.find((it) => pathname === it.href) ??
    ALL_ITEMS.find((it) => it.href !== "/admin" && pathname.startsWith(`${it.href}/`)) ??
    null;

  const isSubPage = pathname !== "/admin";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir navegación"
            className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 p-1.5 text-slate-300 transition-colors hover:border-gold/50 hover:text-gold lg:hidden"
          >
            <Icon name="menu" />
          </button>
          <Link href="/admin" className="flex shrink-0 items-center gap-2 no-underline">
            <span className="font-display text-sm uppercase tracking-[0.18em] text-gold">
              ArenaCup26
            </span>
            <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-rose-300">
              Admin
            </span>
          </Link>
          <div className="ms-auto flex items-center gap-3 text-xs">
            <span className="hidden text-slate-400 sm:inline">{userEmail}</span>
            <a
              href="/api/auth/signout?callbackUrl=https://www.arenacup26.com/"
              className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 font-bold text-slate-200 transition-colors hover:border-rose-500/50 hover:text-rose-300"
            >
              Salir
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <Nav pathname={pathname} />
        </aside>

        <main className="min-w-0 flex-1">
          {isSubPage && (
            <nav
              aria-label="Migas de pan"
              className="mb-4 flex items-center gap-2 text-xs text-slate-400"
            >
              <Link
                href="/admin"
                className="cursor-pointer rounded-md border border-slate-800 bg-slate-900 px-2 py-1 font-bold text-slate-300 transition-colors hover:border-gold/40 hover:text-gold"
              >
                ← Dashboard
              </Link>
              {activeItem && (
                <>
                  <span aria-hidden className="text-slate-600">
                    /
                  </span>
                  <span className="font-bold text-slate-300">{activeItem.label}</span>
                </>
              )}
            </nav>
          )}
          {children}
        </main>
      </div>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Cerrar navegación"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 cursor-pointer border-0 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        aria-hidden={!drawerOpen}
        className={`fixed inset-y-0 start-0 z-50 w-72 transform border-e border-slate-800 bg-slate-900 p-4 shadow-2xl transition-transform lg:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-xs uppercase tracking-[0.18em] text-gold">
            Navegación
          </span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar"
            className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 p-1 text-slate-400 hover:text-rose-300"
          >
            <Icon name="close" />
          </button>
        </div>
        <Nav pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
      </aside>
    </div>
  );
}

function Nav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Secciones del admin" className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {group.title}
          </div>
          <ul className="m-0 list-none space-y-1 p-0">
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm no-underline transition-colors ${
                      isActive
                        ? "border-gold/40 bg-gold/10 text-gold"
                        : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    <Icon name={item.icon} />
                    <span className="flex-1 font-bold">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] font-black text-rose-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Icon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 11v2a2 2 0 0 0 2 2h2l4 4V5L7 9H5a2 2 0 0 0-2 2z" />
          <path d="M15 8a5 5 0 0 1 0 8" />
          <path d="M18 5a9 9 0 0 1 0 14" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a2 2 0 1 0 3 3l6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z" />
        </svg>
      );
    case "users":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "database":
      return (
        <svg {...common} aria-hidden="true">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14a9 3 0 0 0 18 0V5" />
          <path d="M3 12a9 3 0 0 0 18 0" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      );
    case "close":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}
