import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { checkAdmin } from "@/lib/admin-auth";

/**
 * Layout raíz del panel admin (`admin.arenacup26.com`). Server
 * Component que aplica la auth gate antes de renderizar nada:
 *
 *  - Sin sesión → redirect al OAuth Google con callbackUrl = admin home.
 *  - Sesión pero no admin (email no allowlisted o `is_admin=false`
 *    o `banned_until > now`) → redirect a la landing pública.
 *    No mostramos "403 admin only" para no revelar la existencia del
 *    panel a quien no debe verlo.
 *
 * Si pasa la gate, renderiza el shell del admin (header con email +
 * logout, nav lateral). Layout independiente del `[locale]/(app)`
 * del producto — paleta más sobria, sin notificaciones, sin invite.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const check = await checkAdmin();

  if (!check.ok) {
    // Mismo redirect para todos los motivos no-admin: queremos que la
    // experiencia de un visitante curioso vs un user real no-admin vs
    // un email allowlisted pero sin flag sea indistinguible.
    if (check.reason === "no-session") {
      // Vuelve al admin home tras login. El callbackUrl es absoluto
      // para que tras OAuth aterrice en el subdomain admin, no en www.
      redirect("/api/auth/signin?callbackUrl=" + encodeURIComponent("https://admin.arenacup26.com/"));
    }
    // Allowlisted-but-not-flag, not-allowlisted, banned → landing pública.
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
