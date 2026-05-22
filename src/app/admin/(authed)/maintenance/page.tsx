import { getMaintenanceMode } from "@/server/admin/settings";
import { MaintenanceForm } from "./maintenance-form";

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage() {
  const m = await getMaintenanceMode();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-slate-100">Modo mantenimiento</h1>
        <p className="mt-1 text-sm text-slate-400">
          Al activarlo, se muestra un banner global en toda la app y se bloquean las mutaciones
          (predecir, cambiar nombre, aceptar amigos, etc). Las lecturas (ranking, partidos,
          perfiles) siguen funcionando con normalidad.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-slate-400">Estado actual:</span>
          {m.enabled ? (
            <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.14em] text-rose-300">
              Activo
            </span>
          ) : (
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">
              Apagado
            </span>
          )}
        </div>
        <MaintenanceForm initialEnabled={m.enabled} initialMessage={m.message ?? ""} />
      </section>
    </div>
  );
}
