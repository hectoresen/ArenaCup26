import { isAdminEmail } from "@/lib/admin-allowlist";
import { auth } from "@/lib/auth";
import { getMaintenanceMode } from "@/server/admin/settings";

/**
 * Devuelve la decisión sobre qué mostrar al usuario actual cuando
 * el modo mantenimiento está activo.
 *
 * - `none`: el modo está apagado → render normal de la app.
 * - `wall`: bloquear toda la UI con el interstitial. Aplica a
 *    visitantes sin sesión y a humanos logueados.
 * - `bypass`: el visitante es admin allowlisted → no ve el wall,
 *    sigue la app como siempre (para poder desactivar el modo).
 *
 * El check usa la allowlist hardcoded (no consulta BD) — el flag
 * `is_admin` solo lo verifica `checkAdmin` en el panel. Para el wall
 * basta con el email allowlist: si quitamos el flag BD, el admin
 * humano sigue siendo capaz de gestionar.
 */
export async function getMaintenanceDecision(): Promise<
  { kind: "none" } | { kind: "wall"; message: string } | { kind: "bypass" }
> {
  const m = await getMaintenanceMode();
  if (!m.enabled) return { kind: "none" };

  const session = await auth();
  if (session?.user?.email && isAdminEmail(session.user.email)) {
    return { kind: "bypass" };
  }

  return {
    kind: "wall",
    message: m.message ?? "Estamos haciendo mejoras en ArenaCup26. Vuelve en unos minutos.",
  };
}

/**
 * Wall fullscreen que reemplaza la app cuando el modo mantenimiento
 * está activo y el visitante no es admin. Estilo de la plataforma
 * (gold + slate), sin botones — el flow es "vuelve más tarde".
 */
export function MaintenanceWall({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-gold/40 bg-gold/10 text-2xl text-gold">
          ⚒
        </div>
        <div className="font-display text-sm uppercase tracking-[0.18em] text-gold">ArenaCup26</div>
        <h1 className="mt-1 font-display text-2xl text-slate-100">Estamos en mantenimiento</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{message}</p>
        <p className="mt-4 text-xs text-slate-500">Vuelve a abrir la página en unos minutos.</p>
      </div>
    </div>
  );
}
