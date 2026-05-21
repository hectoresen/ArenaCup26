import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { checkAdmin } from "@/lib/admin-auth";

/**
 * Layout raíz del panel admin. Se sirve desde dos hosts posibles:
 *  - `admin.arenacup26.com` (futuro, cuando haya slot de custom domain).
 *  - `wmundial-production.up.railway.app/admin` (actual).
 *
 * Auth gate antes de renderizar nada:
 *  - Sin sesión → redirect al OAuth Google con callbackUrl al admin home.
 *  - Sesión pero no admin (email no allowlisted o `is_admin=false`
 *    o `banned_until > now`) → redirect a la landing pública.
 *    No mostramos "403 admin only" para no revelar la existencia del
 *    panel a quien no debe verlo.
 *
 * El callbackUrl se construye desde el host actual (no hardcoded)
 * para que funcione tanto en railway provided como en el subdomain
 * cuando lo añadamos.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const check = await checkAdmin();
  const reqHeaders = await headers();
  const host = reqHeaders.get("host") ?? "wmundial-production.up.railway.app";
  // En railway provided el admin vive bajo `/admin`. En el subdomain
  // dedicado vive en `/` (porque el middleware reescribe `/` → `/admin`).
  const adminBase = host.startsWith("admin.")
    ? `https://${host}/`
    : `https://${host}/admin`;

  if (!check.ok) {
    if (check.reason === "no-session") {
      redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(adminBase)}`);
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
