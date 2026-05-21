import { headers } from "next/headers";
import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Página de signin propia del admin. Bypassa la default signin page
 * de Auth.js v5, que en multi-host Railway construye el form action
 * con `localhost:8080` ignorando `X-Forwarded-Host` (Railway sí pasa
 * el header — verificado con endpoint debug). El Server Action que
 * envuelve `signIn("google")` corre durante el request en vivo y
 * sí respeta el host, generando un redirect 302 a Google con el
 * `redirect_uri` correcto en `admin.arenacup26.com`.
 *
 * Si ya hay sesión, redirige a `/admin` (el layout se encarga del
 * resto de chequeos: allowlist + is_admin + banned).
 */
export default async function AdminSignin() {
  const session = await auth();
  if (session) redirect("/admin");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "admin.arenacup26.com";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const adminBase = `${proto}://${host}/`;

  async function doSignIn() {
    "use server";
    await signIn("google", { redirectTo: adminBase });
  }

  return (
    <main className="grid min-h-[60vh] place-items-center px-6">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div>
          <div className="font-display text-base uppercase tracking-[0.18em] text-gold">
            ArenaCup26
          </div>
          <div className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-rose-300">
            Panel de administración
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Inicia sesión con tu cuenta de Google autorizada.
        </p>
        <form action={doSignIn}>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-100 transition-colors hover:border-gold/60 hover:text-gold"
          >
            Entrar con Google
          </button>
        </form>
      </div>
    </main>
  );
}
