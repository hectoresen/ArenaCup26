"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveGroup } from "@/server/groups/membership";

type Props = {
  groupId: string;
  groupName: string;
};

/**
 * Botón "Abandonar grupo" + confirm. Regla de negocio (2026-05-19):
 * SIEMPRE congela el perfil — el ex-miembro queda visible en el
 * ranking del grupo con sus puntos al momento de irse y badge "ha
 * salido". Si vuelve a ser invitado, recupera historial.
 *
 * Si el viewer es admin, esta UI NO se renderiza (el server bloquea
 * con `is_admin_cannot_leave`) — el panel admin tiene el flujo de
 * transferir-o-borrar.
 */
export function LeaveGroupButton({ groupId, groupName }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function leave() {
    setError(null);
    startTransition(async () => {
      const res = await leaveGroup({ groupId });
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
      <p className="mb-2 text-[12px] font-bold text-foreground">
        ¿Abandonar "{groupName}"?
      </p>
      <p className="mb-3 text-[11px] font-bold leading-snug text-muted">
        Quedarás con tus puntos actuales como ex-miembro en el ranking del
        grupo. Si te vuelven a invitar, recuperas tu historial completo.
      </p>
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
