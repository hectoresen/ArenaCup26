import { getUserDetailForAdmin } from "@/server/admin/users-list";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserAvatar } from "../_components/user-avatar";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserDetailForAdmin(id);
  if (!user) notFound();

  const isBanned = user.bannedUntil && user.bannedUntil > new Date();

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <UserAvatar name={user.name} image={user.image} avatarId={user.avatarId} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl text-slate-100">{user.name ?? "—"}</h1>
            {user.isBot && (
              <span className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Bot
              </span>
            )}
            {user.isAdmin && (
              <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
                Admin
              </span>
            )}
            {isBanned && (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                Baneado
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-400">{user.email}</div>
          {user.username && (
            <div className="mt-0.5 text-xs text-slate-500">
              @{user.username}
              {!user.isBot && (
                <>
                  {" · "}
                  <Link
                    href={`https://www.arenacup26.com/u/${user.username}`}
                    target="_blank"
                    className="text-gold hover:underline"
                  >
                    perfil público ↗
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Puntos" value={user.stats.totalPoints} highlight />
        <Stat label="Predicciones" value={user.stats.predictionsCount} />
        <Stat label="Logros" value={user.stats.achievementsCount} />
        <Stat label="Amigos" value={user.stats.friendsCount} />
        <Stat label="Grupos" value={user.stats.groupsCount} />
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 font-display text-sm uppercase tracking-[0.14em] text-slate-300">
          Metadata
        </h2>
        <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
          <Row label="ID" value={<code className="text-[11px] text-slate-400">{user.id}</code>} />
          <Row label="País" value={user.country ?? "—"} />
          <Row label="Avatar gallery" value={user.avatarId ?? "—"} />
          <Row label="Creado" value={fmtDate(user.createdAt)} />
          <Row label="Última actividad" value={fmtRelative(user.lastActiveAt)} />
          <Row label="Onboarded" value={fmtDate(user.onboardedAt)} />
          <Row label="Cambio de nombre" value={fmtRelative(user.nameChangedAt)} />
          <Row label="Cambio de avatar" value={fmtRelative(user.avatarChangedAt)} />
          {isBanned && (
            <Row
              label="Ban hasta"
              value={<span className="font-bold text-amber-300">{fmtDate(user.bannedUntil)}</span>}
            />
          )}
        </dl>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-xs text-slate-400">
        <h2 className="mb-2 font-display text-sm uppercase tracking-[0.14em] text-slate-300">
          Acciones (Fase 3)
        </h2>
        <p>
          Banear, desbanear, ajustar puntos manualmente y forzar logout llegarán en la siguiente
          fase. Por ahora la vista es read-only.
        </p>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl ${highlight ? "text-gold" : "text-slate-100"}`}>
        {value.toLocaleString("es")}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/60 py-1.5 last:border-0">
      <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="text-right text-slate-200">{value}</dd>
    </div>
  );
}

const DATE_FMT = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return DATE_FMT.format(d);
}

const RTF = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
function fmtRelative(d: Date | null): string {
  if (!d) return "—";
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) return RTF.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return RTF.format(diffHr, "hour");
  return RTF.format(Math.round(diffHr / 24), "day");
}
