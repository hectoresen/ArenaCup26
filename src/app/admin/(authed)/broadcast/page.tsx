import { listCountriesUsed, listGroupsForBroadcast } from "@/server/admin/targeted-broadcast";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { sql } from "drizzle-orm";
import { BroadcastForm } from "./broadcast-form";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  const [counts, countries, groupsList] = await Promise.all([
    db
      .select({
        humans: sql<number>`count(*) filter (where ${users.isBot} = false)::int`,
      })
      .from(users)
      .then((r) => r[0]?.humans ?? 0),
    listCountriesUsed(),
    listGroupsForBroadcast(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-slate-100">Notificación broadcast</h1>
        <p className="mt-1 text-sm text-slate-400">
          Envía una notificación in-app (campana) a un grupo de usuarios. Sin push web — el
          destinatario la ve cuando abre la app o en el próximo polling (≤60s).
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <BroadcastForm totalHumans={counts} countries={countries} groups={groupsList} />
      </section>
    </div>
  );
}
