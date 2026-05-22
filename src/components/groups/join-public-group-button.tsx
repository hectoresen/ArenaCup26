"use client";

import { joinPublicGroup } from "@/server/groups/membership";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Botón "Unirme al grupo" para visitantes no miembros de un grupo
 * público con cupo libre. La validación final (cap, visibility,
 * banned, ya miembro…) la hace el server action `joinPublicGroup`.
 * El cliente solo se ocupa de la UX: optimistic loading + refresh
 * del router para que el detalle se vuelva a renderizar como
 * miembro tras el éxito.
 */
export function JoinPublicGroupButton({
  groupId,
  full,
}: {
  groupId: string;
  full: boolean;
}) {
  const t = useTranslations("groups.discover.join");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await joinPublicGroup(groupId);
      if (r.ok) {
        router.refresh();
      } else {
        setError(t(`error.${r.code}` as never, { defaultMessage: r.code }));
      }
    });
  }

  if (full) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-3 text-center text-[12px] font-bold text-muted">
        {t("groupFull")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full cursor-pointer rounded-2xl border-2 border-gold/40 bg-gold/15 px-4 py-3 text-center font-display text-[14px] uppercase tracking-[0.08em] text-gold transition-colors hover:border-gold hover:bg-gold/25 disabled:opacity-50"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
      {error && <p className="text-center text-[11px] font-bold text-warm">{error}</p>}
    </div>
  );
}
