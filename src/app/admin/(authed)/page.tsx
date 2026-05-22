import { getRecentAdminActions } from "@/server/admin/audit";
import { getMaintenanceMode } from "@/server/admin/settings";
import { db } from "@/server/db/client";
import { matches, predictions, users } from "@/server/db/schema";
import { sql } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Landing del admin panel (`admin.arenacup26.com/`). Resumen del
 * estado de la plataforma + accesos rápidos a las acciones de
 * Fase 1 (mantenimiento, broadcast) + audit log recientes.
 */
export default async function AdminHome() {
  const [counts] = await db
    .select({
      humans: sql<number>`count(*) filter (where ${users.isBot} = false)::int`,
      bots: sql<number>`count(*) filter (where ${users.isBot} = true)::int`,
    })
    .from(users);

  const [matchCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      live: sql<number>`count(*) filter (where ${matches.status} = 'live')::int`,
      finished: sql<number>`count(*) filter (where ${matches.status} = 'finished')::int`,
    })
    .from(matches);

  const [predCount] = await db.select({ total: sql<number>`count(*)::int` }).from(predictions);

  const maintenance = await getMaintenanceMode();
  const recentActions = await getRecentAdminActions(10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-slate-100">Panel de administración</h1>
        <p className="mt-1 text-sm text-slate-400">Vista general del estado de la plataforma.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Humanos" value={counts?.humans ?? 0} />
        <Stat label="Bots" value={counts?.bots ?? 0} />
        <Stat
          label="Partidos"
          value={matchCounts?.total ?? 0}
          sub={`${matchCounts?.live ?? 0} en vivo · ${matchCounts?.finished ?? 0} acabados`}
        />
        <Stat label="Predicciones" value={predCount?.total ?? 0} />
      </section>

      {maintenance.enabled && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm"
        >
          <span className="text-rose-100">
            <span className="me-2 inline-block h-2 w-2 animate-pulse rounded-full bg-rose-400" />
            Modo mantenimiento <span className="font-black">activo</span> — los usuarios no admin
            ven el wall.
          </span>
          <Link
            href="/admin/maintenance"
            className="shrink-0 cursor-pointer rounded-md border border-rose-500/50 bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-100 transition-colors hover:bg-rose-500/30"
          >
            Gestionar
          </Link>
        </div>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 font-display text-sm uppercase tracking-[0.14em] text-slate-300">
          Actividad admin reciente
        </h2>
        {recentActions.length === 0 ? (
          <p className="text-xs text-slate-500">Aún no hay acciones registradas.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {recentActions.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">
                  <span className="me-2 rounded bg-slate-800 px-1.5 py-0.5 font-bold text-slate-400">
                    {a.action}
                  </span>
                  <span className="text-slate-500">{a.adminEmail ?? "—"}</span>
                </span>
                <time className="shrink-0 text-slate-500">{formatRelative(a.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 font-display text-sm uppercase tracking-[0.14em] text-slate-300">
          Próximas funcionalidades
        </h2>
        <ul className="space-y-1 text-sm text-slate-400">
          <li>· Lista de usuarios + perfil (Fase 2)</li>
          <li>· Backups: listar runs + descarga directa (Fase 2)</li>
          <li>· Acciones destructivas (banear, ajustar puntos, reset) (Fase 3)</li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm">
        <h2 className="mb-3 font-display text-sm uppercase tracking-[0.14em] text-slate-300">
          Enlaces útiles
        </h2>
        <ul className="space-y-1 text-slate-400">
          <li>
            <Link
              href="https://www.arenacup26.com"
              className="text-gold hover:underline"
              target="_blank"
            >
              www.arenacup26.com →
            </Link>{" "}
            (web pública)
          </li>
          <li>
            <Link href="https://railway.app" className="text-gold hover:underline" target="_blank">
              Railway dashboard →
            </Link>{" "}
            (logs + deploys + env vars)
          </li>
          <li>
            <Link href="https://sentry.io" className="text-gold hover:underline" target="_blank">
              Sentry →
            </Link>{" "}
            (errores + performance)
          </li>
          <li>
            <Link
              href="https://github.com/hectoresen/wmundial/actions"
              className="text-gold hover:underline"
              target="_blank"
            >
              GitHub Actions →
            </Link>{" "}
            (crons + backups)
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 font-display text-3xl text-slate-100">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

const RTF = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
function formatRelative(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) return RTF.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return RTF.format(diffHr, "hour");
  return RTF.format(Math.round(diffHr / 24), "day");
}
