"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GROUP_COLORS, type GroupColor } from "@/server/db/schema";
import { GROUP_COLOR_STYLES } from "@/lib/group-colors";
import { createGroup } from "@/server/groups/actions";
import {
  GROUP_MEMBERS_DEFAULT,
  GROUP_MEMBERS_MAX,
  GROUP_MEMBERS_MIN,
} from "@/server/groups/caps";

/**
 * Formulario controlado de creación de grupo. Lleva los 4 inputs:
 *  - Nombre (3-40 chars).
 *  - Color (paleta 8).
 *  - Visibility (public / private).
 *  - Cap de miembros (slider 5-100, default 25).
 *
 * Sin SSR — usamos client state porque el color es una grid visual y
 * queremos feedback instantáneo. La action se llama vía `useTransition`
 * y redirige a `/social/grupos/<id>` al éxito.
 */
export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState<GroupColor>("gold");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [maxMembers, setMaxMembers] = useState<number>(GROUP_MEMBERS_DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameOk = name.trim().length >= 3;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameOk || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await createGroup({ name: name.trim(), color, visibility, maxMembers });
      if (!res.ok) {
        setError(
          res.code === "cap_groups_reached"
            ? "Ya estás en el máximo de grupos activos"
            : res.code === "unauthorized"
              ? "Necesitas iniciar sesión"
              : "No se pudo crear el grupo",
        );
        return;
      }
      if (res.groupId) {
        router.push(`/social/grupos/${res.groupId}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <label className="block">
        <span className="mb-2 block font-display text-[12px] uppercase tracking-[0.12em] text-gold">
          Nombre
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          placeholder="Familia, oficina, peñistas…"
          className="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-[15px] text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
        />
        <span className="mt-1 block text-[11px] font-bold text-muted">
          {name.trim().length}/40
        </span>
      </label>

      <fieldset>
        <legend className="mb-2 font-display text-[12px] uppercase tracking-[0.12em] text-gold">
          Color
        </legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {GROUP_COLORS.map((c) => {
            const styles = GROUP_COLOR_STYLES[c];
            const selected = c === color;
            return (
              <button
                key={c}
                type="button"
                aria-label={styles.label}
                aria-pressed={selected}
                onClick={() => setColor(c)}
                className={`h-11 w-11 cursor-pointer rounded-full ${styles.bg} ${selected ? "ring-4 ring-foreground/80 ring-offset-2 ring-offset-background" : "opacity-80 hover:opacity-100"}`}
              />
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-display text-[12px] uppercase tracking-[0.12em] text-gold">
          Visibilidad
        </legend>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-card px-3 py-3 hover:border-gold/40 has-[input:checked]:border-gold/60 has-[input:checked]:bg-gold/[0.06]">
            <input
              type="radio"
              name="visibility"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
              className="mt-1 accent-gold"
            />
            <div>
              <div className="font-display text-[14px] text-foreground">Privado</div>
              <div className="text-[12px] font-bold text-muted">
                Solo se entra con invitación o link compartido.
              </div>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-card px-3 py-3 hover:border-gold/40 has-[input:checked]:border-gold/60 has-[input:checked]:bg-gold/[0.06]">
            <input
              type="radio"
              name="visibility"
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
              className="mt-1 accent-gold"
            />
            <div>
              <div className="font-display text-[14px] text-foreground">Público</div>
              <div className="text-[12px] font-bold text-muted">
                Aparece en "Descubrir grupos" y cualquiera puede unirse.
              </div>
            </div>
          </label>
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-2 flex items-baseline justify-between font-display text-[12px] uppercase tracking-[0.12em] text-gold">
          Cap de miembros
          <span className="text-foreground">{maxMembers}</span>
        </span>
        <input
          type="range"
          min={GROUP_MEMBERS_MIN}
          max={GROUP_MEMBERS_MAX}
          value={maxMembers}
          onChange={(e) => setMaxMembers(Number(e.target.value))}
          className="w-full accent-gold"
        />
        <span className="mt-1 block text-[11px] font-bold text-muted">
          Entre {GROUP_MEMBERS_MIN} y {GROUP_MEMBERS_MAX}. Puedes ajustarlo después.
        </span>
      </label>

      {error && (
        <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!nameOk || isPending}
        className="cursor-pointer w-full rounded-full bg-gold py-3 font-display text-[13px] uppercase tracking-[0.12em] text-background hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Creando…" : "Crear grupo"}
      </button>
    </form>
  );
}
