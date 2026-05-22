import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { sql } from "drizzle-orm";
import { BroadcastForm } from "./broadcast-form";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  const [counts] = await db
    .select({
      humans: sql<number>`count(*) filter (where ${users.isBot} = false)::int`,
    })
    .from(users);

  const humans = counts?.humans ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-slate-100">Notificación broadcast</h1>
        <p className="mt-1 text-sm text-slate-400">
          Envía una notificación a la campana de todos los usuarios humanos. No envía push (solo
          aparece en la campana al abrir la app).
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 text-xs text-slate-400">
          Destinatarios: <span className="font-bold text-slate-100">{humans}</span> humanos
        </div>
        <BroadcastForm />
      </section>
    </div>
  );
}
