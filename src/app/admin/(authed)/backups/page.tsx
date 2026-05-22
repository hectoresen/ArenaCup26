import { listBackupArtifacts } from "@/server/admin/backups";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminBackupsPage() {
  const result = await listBackupArtifacts();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-slate-100">Backups</h1>
        <p className="mt-1 text-sm text-slate-400">
          Artifacts subidos por los workflows{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px]">db-backup</code> y{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px]">
            db-backup-tournament
          </code>{" "}
          en GitHub Actions.
        </p>
      </div>

      {result.kind === "missing-token" && <MissingTokenCard message={result.message} />}

      {result.kind === "error" && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          <div className="font-bold">Error consultando GitHub API</div>
          <p className="mt-1 text-xs">{result.message}</p>
          <Link
            href="https://github.com/hectoresen/wmundial/actions"
            target="_blank"
            className="mt-3 inline-block text-xs text-rose-200 underline hover:text-rose-100"
          >
            Abrir GitHub Actions →
          </Link>
        </div>
      )}

      {result.kind === "ok" && (
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {result.artifacts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No hay artifacts de backup recientes.
            </p>
          ) : (
            <ul className="m-0 divide-y divide-slate-800 list-none p-0">
              {result.artifacts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-slate-100">{a.name}</span>
                      {a.expired && (
                        <span className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                          Expirado
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {fmtSize(a.sizeInBytes)} · {fmtDate(a.createdAt)} · expira{" "}
                      {fmtRelative(a.expiresAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <Link
                      href={a.workflowRunUrl}
                      target="_blank"
                      className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 font-bold text-slate-200 transition-colors hover:border-gold/40 hover:text-gold"
                    >
                      Workflow ↗
                    </Link>
                    {!a.expired && (
                      <Link
                        href={a.archiveDownloadUrl}
                        className="cursor-pointer rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 font-bold text-gold transition-colors hover:bg-gold/20"
                      >
                        Descargar
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-xs text-slate-400">
        <h2 className="mb-2 font-display text-sm uppercase tracking-[0.14em] text-slate-300">
          Política de retención
        </h2>
        <p>
          GitHub Actions guarda artifacts hasta 90 días por defecto. El workflow{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">db-backup</code> aplica
          además retención inteligente (borra &gt; 10 días si hay al menos 2 backups posteriores).
          Ver{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">docs/backups.md</code>{" "}
          para el detalle.
        </p>
      </section>
    </div>
  );
}

function MissingTokenCard({ message }: { message: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
      <div className="font-bold text-amber-100">Token GitHub no configurado</div>
      <p className="text-xs text-amber-200/90">{message}</p>
      <div className="text-xs text-slate-400">
        <p className="mb-2 font-bold text-slate-300">Para activar el listado integrado:</p>
        <ol className="list-decimal space-y-1 ps-5">
          <li>
            Genera un PAT en{" "}
            <Link
              href="https://github.com/settings/tokens/new?scopes=actions:read&description=ArenaCup26%20Admin"
              target="_blank"
              className="text-gold underline hover:text-amber-300"
            >
              github.com/settings/tokens
            </Link>{" "}
            con scope <code className="rounded bg-slate-800 px-1 text-[10px]">actions:read</code>.
          </li>
          <li>
            Añade la variable{" "}
            <code className="rounded bg-slate-800 px-1 text-[10px]">GITHUB_TOKEN</code> en Railway
            (servicio wmundial).
          </li>
          <li>El próximo redeploy mostrará la tabla aquí.</li>
        </ol>
      </div>
      <Link
        href="https://github.com/hectoresen/wmundial/actions"
        target="_blank"
        className="inline-block cursor-pointer rounded-md border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-500/30"
      >
        Mientras tanto: abrir GitHub Actions →
      </Link>
    </div>
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const DATE_FMT = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
function fmtDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

const RTF = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
function fmtRelative(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffHr = Math.round(diffMs / (60 * 60 * 1000));
  if (Math.abs(diffHr) < 24) return RTF.format(diffHr, "hour");
  return RTF.format(Math.round(diffHr / 24), "day");
}
