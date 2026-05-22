"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Input de búsqueda con debounce manual (envía al submit/enter para
 * no spammear la BD). Conserva el resto de query params (filtros).
 */
export function UserSearchInput({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function submit() {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (value.trim().length > 0) {
      next.set("q", value.trim());
    } else {
      next.delete("q");
    }
    next.delete("page");
    startTransition(() => {
      router.push(`/admin/users?${next.toString()}`);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2"
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por nombre, email o username…"
        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-50"
      >
        {pending ? "Buscando…" : "Buscar"}
      </button>
    </form>
  );
}
