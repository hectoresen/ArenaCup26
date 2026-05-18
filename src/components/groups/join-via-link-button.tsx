"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinGroupViaLink } from "@/server/groups/membership";

type Props = {
  token: string;
  groupId: string;
};

/**
 * Botón "Unirme" en la landing del invite link. Llama al action y al
 * éxito redirige a la página de detalle del grupo. Muestra error
 * inline si la action falla (cap reached, group full, etc).
 */
export function JoinViaLinkButton({ token, groupId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle() {
    setError(null);
    startTransition(async () => {
      const res = await joinGroupViaLink(token);
      if (!res.ok) {
        setError(
          res.code === "cap_groups_reached"
            ? "Ya estás en el máximo de grupos activos"
            : res.code === "group_full"
              ? "Este grupo está lleno"
              : res.code === "link_revoked"
                ? "Este link ha sido revocado por el admin"
                : res.code === "link_exhausted"
                  ? "Este link ha agotado sus usos"
                  : res.code === "group_deleted"
                    ? "Este grupo ya no existe"
                    : "No se pudo unirse al grupo",
        );
        return;
      }
      router.push(`/social/grupos/${groupId}`);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handle}
        disabled={isPending}
        className="w-full rounded-full bg-gold py-3 font-display text-[13px] uppercase tracking-[0.12em] text-background hover:bg-gold-deep disabled:opacity-50"
      >
        {isPending ? "Uniéndome…" : "Unirme al grupo"}
      </button>
      {error && (
        <div className="mt-3 rounded-2xl border-2 border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-300">
          {error}
        </div>
      )}
    </>
  );
}
