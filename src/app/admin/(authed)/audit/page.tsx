import { getRecentAdminActions } from "@/server/admin/audit";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const entries = await getRecentAdminActions(200);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-slate-100">Audit log</h1>
        <p className="mt-1 text-sm text-slate-400">
          Registro append-only de todas las acciones admin. Mostrando las últimas {entries.length}.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            Aún no hay acciones registradas.
          </p>
        ) : (
          <ul className="m-0 divide-y divide-slate-800 list-none p-0">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${actionTone(
                        e.action,
                      )}`}
                    >
                      {e.action}
                    </span>
                    <span className="text-xs text-slate-400">{e.adminEmail ?? "—"}</span>
                  </div>
                  <time className="text-[11px] text-slate-500">{fmtDate(e.createdAt)}</time>
                </div>
                {e.targetId && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    target:{" "}
                    <code className="text-slate-400">
                      {e.targetType ?? "—"}/{e.targetId}
                    </code>
                  </div>
                )}
                {e.payload != null && (
                  <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-[11px] text-slate-300">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function actionTone(action: string): string {
  if (action.startsWith("user_banned") || action.includes("revoked")) {
    return "border border-amber-500/40 bg-amber-500/10 text-amber-300";
  }
  if (action.startsWith("user_unbanned")) {
    return "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }
  if (action.includes("points")) {
    return "border border-gold/40 bg-gold/10 text-gold";
  }
  if (action.includes("broadcast")) {
    return "border border-sky-500/40 bg-sky-500/10 text-sky-300";
  }
  if (action.includes("maintenance")) {
    return "border border-rose-500/40 bg-rose-500/10 text-rose-300";
  }
  return "border border-slate-700 bg-slate-800 text-slate-300";
}

const DATE_FMT = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
function fmtDate(d: Date): string {
  return DATE_FMT.format(d);
}
