"use client";

import { useEffect, useState, useTransition } from "react";
import { previewBroadcastTarget, sendBroadcast } from "./actions";

type TargetKind = "all" | "users" | "filter" | "group";

type Target =
  | { kind: "all" }
  | { kind: "users"; identifiers: string[] }
  | { kind: "group"; groupId: string }
  | {
      kind: "filter";
      countries?: string[];
      topN?: number;
      activeSinceDays?: number;
    };

type Props = {
  totalHumans: number;
  countries: { code: string; count: number }[];
  groups: { id: string; name: string; memberCount: number }[];
};

export function BroadcastForm({ totalHumans, countries, groups }: Props) {
  const [kind, setKind] = useState<TargetKind>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // State del tab "Selección"
  const [identifiersRaw, setIdentifiersRaw] = useState("");

  // State del tab "Filtro"
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [topNRaw, setTopNRaw] = useState("");
  const [activeDaysRaw, setActiveDaysRaw] = useState("");

  // State del tab "Grupo"
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");

  // Preview count (refreshed on target change con debounce)
  const [preview, setPreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "ok"; recipients: number; notFound: string[] } | { kind: "err"; text: string } | null
  >(null);

  const target = buildTarget({
    kind,
    identifiersRaw,
    selectedCountries,
    topNRaw,
    activeDaysRaw,
    groupId,
  });

  // Preview con debounce 400ms.
  useEffect(() => {
    if (!target) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const id = setTimeout(async () => {
      const r = await previewBroadcastTarget(target);
      setPreview(r.ok ? r.count : null);
      setPreviewLoading(false);
    }, 400);
    return () => {
      clearTimeout(id);
      setPreviewLoading(false);
    };
  }, [target]);

  function submit() {
    setFeedback(null);
    if (title.trim().length === 0) {
      setFeedback({ kind: "err", text: "Título obligatorio." });
      return;
    }
    if (!target) {
      setFeedback({ kind: "err", text: "Target inválido." });
      return;
    }
    startTransition(async () => {
      const r = await sendBroadcast({
        title: title.trim(),
        body: body.trim().length > 0 ? body.trim() : null,
        target,
      });
      if (r.ok) {
        setFeedback({
          kind: "ok",
          recipients: r.recipients,
          notFound: r.notFoundIdentifiers,
        });
        setTitle("");
        setBody("");
      } else {
        setFeedback({ kind: "err", text: `Error: ${r.error}` });
      }
    });
  }

  return (
    <div className="space-y-5">
      <Tabs kind={kind} onChange={setKind} totalHumans={totalHumans} />

      <div className="space-y-3">
        {kind === "all" && (
          <p className="text-xs text-slate-400">
            Se enviará a <strong>todos los humanos activos</strong> (no banned, no bots).
          </p>
        )}

        {kind === "users" && <UsersTab value={identifiersRaw} onChange={setIdentifiersRaw} />}

        {kind === "filter" && (
          <FilterTab
            countries={countries}
            selectedCountries={selectedCountries}
            setSelectedCountries={setSelectedCountries}
            topNRaw={topNRaw}
            setTopNRaw={setTopNRaw}
            activeDaysRaw={activeDaysRaw}
            setActiveDaysRaw={setActiveDaysRaw}
          />
        )}

        {kind === "group" && <GroupTab groups={groups} value={groupId} onChange={setGroupId} />}
      </div>

      <PreviewLine loading={previewLoading} count={preview} target={target} />

      <div className="space-y-3 border-t border-slate-800 pt-4">
        <div>
          <label
            htmlFor="bc-title"
            className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
          >
            Título (obligatorio)
          </label>
          <input
            id="bc-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="¡Empieza el Mundial!"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
          />
          <div className="mt-1 text-right text-[10px] text-slate-500">{title.length}/140</div>
        </div>
        <div>
          <label
            htmlFor="bc-body"
            className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
          >
            Cuerpo (opcional)
          </label>
          <textarea
            id="bc-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Texto del cuerpo de la notificación…"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
          />
          <div className="mt-1 text-right text-[10px] text-slate-500">{body.length}/500</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || title.trim().length === 0 || !target}
          className="cursor-pointer rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-bold text-gold transition-colors hover:border-gold hover:bg-gold/20 disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Enviar"}
        </button>
        {feedback?.kind === "ok" && (
          <div className="text-xs">
            <span className="font-bold text-emerald-300">
              Enviado a {feedback.recipients} usuarios.
            </span>
            {feedback.notFound.length > 0 && (
              <div className="mt-1 text-amber-300">
                No encontrados: {feedback.notFound.join(", ")}
              </div>
            )}
          </div>
        )}
        {feedback?.kind === "err" && (
          <span className="text-xs font-bold text-rose-300">{feedback.text}</span>
        )}
      </div>
    </div>
  );
}

function Tabs({
  kind,
  onChange,
  totalHumans,
}: {
  kind: TargetKind;
  onChange: (k: TargetKind) => void;
  totalHumans: number;
}) {
  const tabs: { value: TargetKind; label: string; subtitle?: string }[] = [
    { value: "all", label: "Todos", subtitle: `${totalHumans} humanos` },
    { value: "users", label: "Selección" },
    { value: "filter", label: "Filtro" },
    { value: "group", label: "Grupo" },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            kind === t.value
              ? "border-gold/40 bg-gold/10 text-gold"
              : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-slate-100"
          }`}
        >
          {t.label}
          {t.subtitle && (
            <span className="ml-1.5 text-[10px] font-normal opacity-70">({t.subtitle})</span>
          )}
        </button>
      ))}
    </div>
  );
}

function UsersTab({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label
        htmlFor="bc-users"
        className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
      >
        Usuarios (uno por línea, email o username)
      </label>
      <textarea
        id="bc-users"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder={"hector.escolante@clouddistrict.com\nusername123\n…"}
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
      />
      <p className="mt-1 text-[10px] text-slate-500">Máximo 200 por envío.</p>
    </div>
  );
}

function FilterTab({
  countries,
  selectedCountries,
  setSelectedCountries,
  topNRaw,
  setTopNRaw,
  activeDaysRaw,
  setActiveDaysRaw,
}: {
  countries: { code: string; count: number }[];
  selectedCountries: string[];
  setSelectedCountries: (c: string[]) => void;
  topNRaw: string;
  setTopNRaw: (v: string) => void;
  activeDaysRaw: string;
  setActiveDaysRaw: (v: string) => void;
}) {
  function toggleCountry(code: string) {
    setSelectedCountries(
      selectedCountries.includes(code)
        ? selectedCountries.filter((c) => c !== code)
        : [...selectedCountries, code],
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
          Países ({selectedCountries.length} seleccionados)
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {countries.length === 0 ? (
            <span className="text-xs text-slate-500">No hay países registrados.</span>
          ) : (
            countries.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleCountry(c.code)}
                className={`cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                  selectedCountries.includes(c.code)
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                }`}
              >
                {c.code} · {c.count}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="bc-topn"
            className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
          >
            Top N del ranking (opcional)
          </label>
          <input
            id="bc-topn"
            type="number"
            min={1}
            max={10000}
            value={topNRaw}
            onChange={(e) => setTopNRaw(e.target.value)}
            placeholder="ej. 100"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="bc-active"
            className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
          >
            Activos últimos N días (opcional)
          </label>
          <input
            id="bc-active"
            type="number"
            min={1}
            max={365}
            value={activeDaysRaw}
            onChange={(e) => setActiveDaysRaw(e.target.value)}
            placeholder="ej. 7"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function GroupTab({
  groups,
  value,
  onChange,
}: {
  groups: { id: string; name: string; memberCount: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (groups.length === 0) {
    return <p className="text-xs text-slate-500">No hay grupos activos en la plataforma.</p>;
  }
  return (
    <div>
      <label
        htmlFor="bc-group"
        className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
      >
        Grupo
      </label>
      <select
        id="bc-group"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full cursor-pointer rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-gold focus:outline-none"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} ({g.memberCount} miembros)
          </option>
        ))}
      </select>
    </div>
  );
}

function PreviewLine({
  loading,
  count,
  target,
}: {
  loading: boolean;
  count: number | null;
  target: Target | null;
}) {
  if (!target) {
    return (
      <p className="text-xs text-amber-300">
        Completa el target para ver cuántos usuarios recibirán la notificación.
      </p>
    );
  }
  if (loading) {
    return <p className="text-xs text-slate-500">Calculando destinatarios…</p>;
  }
  if (count === null) return null;
  return (
    <p className="text-xs">
      <span className="font-bold text-slate-200">
        {count.toLocaleString("es")} {count === 1 ? "destinatario" : "destinatarios"}
      </span>
      <span className="ml-1 text-slate-500">(humanos no baneados que coinciden).</span>
    </p>
  );
}

function buildTarget(input: {
  kind: TargetKind;
  identifiersRaw: string;
  selectedCountries: string[];
  topNRaw: string;
  activeDaysRaw: string;
  groupId: string;
}): Target | null {
  if (input.kind === "all") return { kind: "all" };

  if (input.kind === "users") {
    const ids = input.identifiersRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (ids.length === 0 || ids.length > 200) return null;
    return { kind: "users", identifiers: ids };
  }

  if (input.kind === "group") {
    if (!input.groupId) return null;
    return { kind: "group", groupId: input.groupId };
  }

  // filter
  const t: Extract<Target, { kind: "filter" }> = { kind: "filter" };
  if (input.selectedCountries.length > 0) t.countries = input.selectedCountries;
  const topN = Number.parseInt(input.topNRaw, 10);
  if (!Number.isNaN(topN) && topN > 0) t.topN = topN;
  const days = Number.parseInt(input.activeDaysRaw, 10);
  if (!Number.isNaN(days) && days > 0) t.activeSinceDays = days;
  // Si no hay ningún filtro definido, no permitimos enviar a "todos"
  // por accidente desde el tab Filtro.
  if (!t.countries && !t.topN && !t.activeSinceDays) return null;
  return t;
}
