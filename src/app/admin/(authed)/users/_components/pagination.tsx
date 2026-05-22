import Link from "next/link";

/**
 * Paginación minimal: anterior / actual / siguiente + jump al
 * principio si no estamos en página 1. El admin no necesita una
 * paginación elaborada — al volumen actual con 25 rows/página son
 * pocas páginas para llegar a cualquier user vía búsqueda.
 */
export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-500">
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 && (
          <Link
            href={buildHref(page - 1)}
            className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 font-bold text-slate-200 transition-colors hover:border-gold/40 hover:text-gold"
          >
            ← Anterior
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={buildHref(page + 1)}
            className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 font-bold text-slate-200 transition-colors hover:border-gold/40 hover:text-gold"
          >
            Siguiente →
          </Link>
        )}
      </div>
    </nav>
  );
}
