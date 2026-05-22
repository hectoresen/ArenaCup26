import { type UserListFilter, listUsersForAdmin } from "@/server/admin/users-list";
import Link from "next/link";
import { Pagination } from "./_components/pagination";
import { UserAvatar } from "./_components/user-avatar";
import { UserSearchInput } from "./_components/user-search-input";

export const dynamic = "force-dynamic";

const KIND_OPTIONS: { value: UserListFilter["kind"]; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "human", label: "Humanos" },
  { value: "bot", label: "Bots" },
];

const BAN_OPTIONS: { value: UserListFilter["ban"]; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "banned", label: "Baneados" },
];

type SearchParams = Promise<{
  kind?: string;
  ban?: string;
  q?: string;
  page?: string;
}>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filter: UserListFilter = {
    kind: sp.kind === "human" || sp.kind === "bot" || sp.kind === "all" ? sp.kind : "all",
    ban: sp.ban === "active" || sp.ban === "banned" || sp.ban === "all" ? sp.ban : "all",
    search: sp.q?.trim() || null,
  };
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;

  const result = await listUsersForAdmin({ filter, page });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-slate-100">Usuarios</h1>
        <p className="mt-1 text-sm text-slate-400">
          {result.total.toLocaleString("es")} en total · página {result.page} de{" "}
          {Math.max(1, Math.ceil(result.total / result.pageSize))}
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <UserSearchInput initialValue={filter.search ?? ""} />

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <FilterGroup label="Tipo">
            {KIND_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                href={buildHref({ ...filter, kind: opt.value, page: 1 })}
                active={filter.kind === opt.value}
                label={opt.label}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Estado">
            {BAN_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                href={buildHref({ ...filter, ban: opt.value, page: 1 })}
                active={filter.ban === opt.value}
                label={opt.label}
              />
            ))}
          </FilterGroup>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {result.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            No hay usuarios con esos filtros.
          </p>
        ) : (
          <ul className="m-0 divide-y divide-slate-800 list-none p-0">
            {result.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/users/${row.id}`}
                  className="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-slate-800/60"
                >
                  <UserAvatar name={row.name} image={row.image} avatarId={row.avatarId} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-slate-100">{row.name ?? "—"}</span>
                      <Badges row={row} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="truncate">{row.email}</span>
                      {row.username && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">@{row.username}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="hidden text-right text-xs sm:block">
                    <div className="font-bold text-gold">
                      {row.totalPoints.toLocaleString("es")}{" "}
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">
                        pts
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">{row.predictionsCount} pred.</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        buildHref={(p) => buildHref({ ...filter, page: p })}
      />
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-bold no-underline transition-colors ${
        active
          ? "border-gold/40 bg-gold/10 text-gold"
          : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}

function Badges({
  row,
}: {
  row: { isBot: boolean; isAdmin: boolean; bannedUntil: Date | null };
}) {
  const isBanned = row.bannedUntil && row.bannedUntil > new Date();
  return (
    <div className="flex shrink-0 items-center gap-1">
      {row.isBot && (
        <span className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
          Bot
        </span>
      )}
      {row.isAdmin && (
        <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-300">
          Admin
        </span>
      )}
      {isBanned && (
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
          Baneado
        </span>
      )}
    </div>
  );
}

function buildHref(input: {
  kind: UserListFilter["kind"];
  ban: UserListFilter["ban"];
  search: string | null;
  page: number;
}): string {
  const params = new URLSearchParams();
  if (input.kind !== "all") params.set("kind", input.kind);
  if (input.ban !== "all") params.set("ban", input.ban);
  if (input.search) params.set("q", input.search);
  if (input.page !== 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}
