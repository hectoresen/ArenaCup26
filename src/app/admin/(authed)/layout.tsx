import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { checkAdmin } from "@/lib/admin-auth";
import "../../globals.css";

/**
 * Layout del subtree `/admin/(authed)/*` — todo el panel admin
 * funcional. Sirve desde `admin.arenacup26.com` (el middleware
 * reescribe `/` → `/admin`).
 *
 * Auth gate antes de renderizar:
 *  - Sin sesión → redirect a `/admin/signin` (nuestra signin custom).
 *    NO usamos `/api/auth/signin` (default de Auth.js) porque su
 *    form action sale con `localhost:8080` en multi-host Railway —
 *    Auth.js v5 no respeta `X-Forwarded-Host` en esa página. La
 *    custom page envuelve `signIn("google")` en un Server Action,
 *    que sí ejecuta con contexto de request y genera la OAuth URL
 *    correcta.
 *  - Sesión pero no admin (no allowlisted / is_admin=false / banned)
 *    → redirect a landing pública. No revelamos la existencia del
 *    panel con un "403 admin only".
 */
export default async function AdminAuthedLayout({ children }: { children: ReactNode }) {
  const check = await checkAdmin();

  if (!check.ok) {
    if (check.reason === "no-session") {
      redirect("/admin/signin");
    }
    redirect("https://www.arenacup26.com/");
  }

  return (
    <html lang="es" className="bg-slate-950">
      <body className="min-h-screen text-slate-100 antialiased">
        <header className="border-b border-slate-800 bg-slate-900 px-6 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm uppercase tracking-[0.18em] text-gold">
                ArenaCup26
              </span>
              <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-rose-300">
                Admin
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">{check.user.email}</span>
              <a
                href="/api/auth/signout?callbackUrl=https://www.arenacup26.com/"
                className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 font-bold text-slate-200 transition-colors hover:border-rose-500/50 hover:text-rose-300"
              >
                Salir
              </a>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
