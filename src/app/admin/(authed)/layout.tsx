import { checkAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "./_shell/admin-shell";
import "../../globals.css";

/**
 * Layout del subtree `/admin/(authed)/*` — todo el panel admin
 * funcional. Sirve desde `admin.arenacup26.com` (el middleware
 * reescribe `/` → `/admin`).
 *
 * Auth gate antes de renderizar:
 *  - Sin sesión → redirect a `/admin/signin` (nuestra signin custom).
 *  - Sesión pero no admin (no allowlisted / is_admin=false / banned)
 *    → redirect a landing pública. No revelamos la existencia del
 *    panel con un "403 admin only".
 *
 * Toda la chrome (header + sidebar + breadcrumb) la pone `AdminShell`
 * para que cada page se centre en su contenido específico.
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
        <AdminShell userEmail={check.user.email}>{children}</AdminShell>
      </body>
    </html>
  );
}
