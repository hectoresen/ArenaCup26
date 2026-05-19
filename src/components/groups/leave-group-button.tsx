"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveGroup } from "@/server/groups/membership";

type Props = {
  groupId: string;
  groupName: string;
};

/**
 * Botón "Abandonar grupo" + diálogo con la opción de mantener perfil
 * congelado en el ranking. Si el viewer es admin, esta UI NO se
 * muestra (la action bloquea con `is_admin_cannot_leave`) — el panel
 * admin tiene el flujo de transferir-o-borrar.
 */
export function LeaveGroupButton({ groupId, groupName }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [freezeProfile, setFreezeProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function leave() {
    setError(null);
    startTransition(async () => {
      const res = await leaveGroup({ groupId, freezeProfile });
      if (res.ok) {
        router.push("/social");
        router.refresh();
        return;
      }
      setError(
        res.code === "is_admin_cannot_leave"
          ? "Como admin debes transferir o borrar el grupo antes de salir"
          : "No se pudo abandonar el grupo",
      );
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer rounded-full border-2 border-border bg-card-hover px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-muted hover:border-red-500/40 hover:text-foreground"
      >
        Abandonar grupo
      </button>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-3">
      <p className="mb-3 text-[12px] font-bold text-foreground">
        ¿Abandonar "{groupName}"?
      </p>
      <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <input
          type="checkbox"
          checked={freezeProfile}
          onChange={(e) => setFreezeProfile(e.target.checked)}
          className="mt-0.5 accent-gold"
        />
        <span className="text-[12px] font-bold text-foreground">
          Mantener mi perfil congelado en el ranking del grupo (con mis puntos
          actuales). Si lo desactivas, desaparecerás completamente.
        </span>
      </label>
      {error && (
        <div className="mb-2 rounded-xl border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-[12px] font-bold text-red-300">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={leave}
          disabled={isPending}
          className="cursor-pointer rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Abandonar
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="cursor-pointer rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
