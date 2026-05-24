"use client";

import type { UserSearchRow } from "@/server/admin/targeted-broadcast";
import { useEffect, useRef, useState, useTransition } from "react";
import { searchUsers } from "./actions";

type Props = {
  /** Usuarios actualmente seleccionados (chips visibles). */
  selected: UserSearchRow[];
  /** Lo llama el padre cuando cambia la selección. */
  onChange: (next: UserSearchRow[]) => void;
};

/**
 * Combobox accesible para el tab "Selección" del broadcast:
 *  - Input de búsqueda con debounce 250ms.
 *  - Server action `searchUsers` devuelve hasta 20 humanos.
 *  - Lista desplegable con resultados (name + @username + email).
 *  - Click en resultado → añade chip a `selected` (max 200).
 *  - Chips con botón × para quitar.
 *  - Si la query está vacía, abre con los 20 más recientes activos.
 *
 * No usamos `<select multiple>` ni librerías externas — la UX nativa
 * de select-multi es horrible y el autocomplete custom es más rápido
 * que añadir react-select para 1 caso.
 */
export function UsersPicker({ selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchRow[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIds = new Set(selected.map((u) => u.id));

  // Debounced fetch al cambiar query.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      startTransition(async () => {
        const r = await searchUsers(query);
        if (r.ok) {
          setResults(r.rows);
        }
      });
    }, 250);
    return () => clearTimeout(id);
  }, [query, open]);

  // Click fuera → cerrar dropdown.
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function toggle(user: UserSearchRow) {
    if (selectedIds.has(user.id)) {
      onChange(selected.filter((u) => u.id !== user.id));
    } else {
      if (selected.length >= 200) return;
      onChange([...selected, user]);
    }
  }

  function remove(userId: string) {
    onChange(selected.filter((u) => u.id !== userId));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="space-y-3">
      {/* Chips de seleccionados */}
      {selected.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-950 p-2">
          <div className="mb-2 flex items-center justify-between text-[10px]">
            <span className="font-black uppercase tracking-[0.12em] text-slate-400">
              Seleccionados ({selected.length}/200)
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="cursor-pointer font-bold text-rose-300 hover:text-rose-200"
            >
              Quitar todos
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-bold text-gold"
              >
                {u.name ?? u.username ?? u.email}
                <button
                  type="button"
                  onClick={() => remove(u.id)}
                  aria-label={`Quitar ${u.name ?? u.email}`}
                  className="cursor-pointer text-gold hover:text-rose-300"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Input + dropdown */}
      <div ref={containerRef} className="relative">
        <label
          htmlFor="bc-users-search"
          className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
        >
          Buscar usuario
        </label>
        <input
          ref={inputRef}
          id="bc-users-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Nombre, username o email…"
          autoComplete="off"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
        />

        {open && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            {pending && results.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500">Buscando…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500">
                {query.trim().length > 0 ? "Sin resultados." : "Aún no hay usuarios."}
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-slate-800 p-0">
                {results.map((u) => {
                  const isSelected = selectedIds.has(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => toggle(u)}
                        className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-800 ${
                          isSelected ? "bg-gold/[0.06]" : ""
                        }`}
                      >
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                            isSelected ? "border-gold bg-gold text-slate-950" : "border-slate-600"
                          }`}
                          aria-hidden
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[12px]">
                            <span className="truncate font-bold text-slate-100">
                              {u.name ?? "—"}
                            </span>
                            {u.username && (
                              <span className="truncate text-slate-500">@{u.username}</span>
                            )}
                          </div>
                          <div className="truncate text-[10px] text-slate-500">{u.email}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
