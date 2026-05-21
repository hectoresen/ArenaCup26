import { sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/server/db/client";
import { matches, predictions, users } from "@/server/db/schema";

/**
 * Landing del admin panel (`admin.arenacup26.com/`). Dashboard
 * read-only con métricas básicas que dan visión inmediata del estado
 * del producto. Sin acciones — esas viven en sub-rutas que añadirán
 * las fases siguientes.
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

  const [predCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(predictions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-slate-100">Panel de administración</h1>
        <p className="mt-1 text-sm text-slate-400">
          Vista general del estado de la plataforma.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Humanos" value={counts?.humans ?? 0} />
        <Stat label="Bots" value={counts?.bots ?? 0} />
        <Stat label="Partidos" value={matchCounts?.total ?? 0} sub={`${matchCounts?.live ?? 0} en vivo · ${matchCounts?.finished ?? 0} acabados`} />
        <Stat label="Predicciones" value={predCount?.total ?? 0} />
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 font-display text-sm uppercase tracking-[0.14em] text-slate-300">
          Próximas funcionalidades
        </h2>
        <ul className="space-y-1 text-sm text-slate-400">
          <li>· Lista de usuarios + perfil (Fase 2)</li>
          <li>· Maintenance mode toggle (Fase 1)</li>
          <li>· Broadcast notification (Fase 1)</li>
          <li>· Acciones destructivas (banear, ajustar puntos, reset) (Fase 3)</li>
          <li>· Backups: listar runs + descarga directa (Fase 2)</li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm">
        <h2 className="mb-3 font-display text-sm uppercase tracking-[0.14em] text-slate-300">
          Enlaces útiles
        </h2>
        <ul className="space-y-1 text-slate-400">
          <li>
            <Link href="https://www.arenacup26.com" className="text-gold hover:underline" target="_blank">
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
            <Link href="https://github.com/hectoresen/wmundial/actions" className="text-gold hover:underline" target="_blank">
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
