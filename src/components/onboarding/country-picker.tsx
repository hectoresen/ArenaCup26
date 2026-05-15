"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CountryFlag } from "@/components/common/country-flag";
import { COUNTRIES } from "@/lib/format/countries";

type Props = {
  value: string;
  onChange: (code: string) => void;
  label: string;
};

/**
 * Combobox custom de país. Reemplaza al `<select>` nativo porque en
 * Windows/WSL los `<option>` se renderizan con la fuente del SO y
 * los emoji de bandera no se ven. Aquí controlamos el render con
 * nuestra fuente (Noto Color Emoji como fallback) → emojis visibles
 * en cualquier sistema.
 *
 * Funcional: búsqueda por nombre o código + cierre por click fuera
 * y tecla Escape, accesible con teclado (flechas + Enter).
 */
export function CountryPicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = COUNTRIES.find((c) => c.code === value) ?? COUNTRIES[0]!;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Reset highlight cuando cambia el filtro
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
    buttonRef.current?.focus();
  }

  function onListKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[highlight];
      if (item) pick(item.code);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex w-full cursor-pointer items-center justify-between rounded-xl border-2 border-border bg-card-hover px-3 py-2 text-sm font-bold text-foreground transition-colors hover:border-gold/40 focus:border-gold focus:outline-none"
      >
        <span className="flex items-center gap-2">
          <CountryFlag code={selected.code} name={selected.name} size={22} className="rounded-sm" />
          <span>{selected.name}</span>
        </span>
        <span aria-hidden="true" className="text-xs text-muted">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border-2 border-gold/30 bg-card shadow-[0_24px_48px_rgba(0,0,0,0.45)] [animation:popIn_0.18s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
          <input
            type="text"
            autoFocus
            placeholder="Buscar país…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKey}
            className="block w-full border-b-2 border-border bg-card-hover px-3 py-2 text-sm font-bold text-foreground placeholder:text-muted/60 focus:outline-none"
          />
          <ul ref={listRef} role="listbox" className="m-0 max-h-64 list-none overflow-y-auto p-0">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-[12px] font-bold text-muted">Sin resultados</li>
            ) : (
              filtered.map((c, i) => (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.code === value}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(c.code)}
                    className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-start text-sm font-bold text-foreground transition-colors ${
                      i === highlight ? "bg-gold/15" : "hover:bg-card-hover"
                    } ${c.code === value ? "text-gold" : ""}`}
                  >
                    <CountryFlag code={c.code} name={c.name} size={20} className="rounded-sm" />
                    <span className="flex-1">{c.name}</span>
                    <span className="text-[10px] font-extrabold text-muted">{c.code}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
