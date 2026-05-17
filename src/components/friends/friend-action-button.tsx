"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  acceptFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/server/friends/actions";
import type { ViewerRelation } from "@/server/friends/types";

type Props = {
  /** Relación inicial calculada server-side. */
  initialRelation: ViewerRelation;
  /** Username del owner del perfil — necesario para sendFriendRequest. */
  targetUsername: string;
  /** UUID del owner — necesario para removeFriend. */
  targetUserId: string;
  /** UUID de la solicitud pendiente si initialRelation === pending-in. */
  pendingFriendshipId?: string | null;
};

/**
 * CTA contextual del perfil `/u/<username>`. Cambia de label/acción
 * según `ViewerRelation`:
 *  - `none` → "+ Añadir amigo".
 *  - `pending-out` → "⏳ Solicitud enviada" (disabled).
 *  - `pending-in` → "Aceptar solicitud".
 *  - `accepted` → "✓ Amigos" (click → "Eliminar amigo").
 *  - `blocked-by-me` / `blocked-by-them` / `self` → no se renderiza.
 *
 * Optimista: cambia el state local antes de la action.
 */
export function FriendActionButton({
  initialRelation,
  targetUsername,
  targetUserId,
  pendingFriendshipId,
}: Props) {
  const t = useTranslations("friends.actionButton");
  const tCommon = useTranslations("common.confirm");
  const [relation, setRelation] = useState<ViewerRelation>(initialRelation);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (relation === "self" || relation === "blocked-by-me" || relation === "blocked-by-them") {
    return null;
  }

  function send() {
    const prev = relation;
    setRelation("pending-out");
    startTransition(async () => {
      const result = await sendFriendRequest(targetUsername);
      if (!result.ok) setRelation(prev);
    });
  }

  function accept() {
    if (!pendingFriendshipId) return;
    const prev = relation;
    setRelation("accepted");
    startTransition(async () => {
      const result = await acceptFriendRequest(pendingFriendshipId);
      if (!result.ok) setRelation(prev);
    });
  }

  function confirmRemove() {
    setConfirmOpen(false);
    const prev = relation;
    setRelation("none");
    startTransition(async () => {
      const result = await removeFriend(targetUserId);
      if (!result.ok) setRelation(prev);
    });
  }

  if (relation === "none") {
    return (
      <button
        type="button"
        onClick={send}
        disabled={isPending}
        className="cursor-pointer rounded-full border-2 border-gold/40 bg-gradient-to-br from-gold to-gold-deep px-5 py-1.5 font-display text-[12px] uppercase tracking-[0.12em] text-[#1a1000] shadow-[0_0_16px_rgba(245,200,66,0.25)] transition-[transform] hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
      >
        + {t("add")}
      </button>
    );
  }

  if (relation === "pending-out") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-card-hover px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted">
        ⏳ {t("pendingOut")}
      </span>
    );
  }

  if (relation === "pending-in") {
    return (
      <button
        type="button"
        onClick={accept}
        disabled={isPending}
        className="cursor-pointer rounded-full border-2 border-success/40 bg-success/10 px-5 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-success transition-colors hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("acceptIn")}
      </button>
    );
  }

  // accepted
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        className="cursor-pointer rounded-full border-2 border-border bg-card-hover px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
      >
        ✓ {t("friends")}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={t("removeTitle")}
        body={t("removeBody")}
        confirmLabel={t("removeCta")}
        cancelLabel={tCommon("cancel")}
        variant="danger"
        isPending={isPending}
        onConfirm={confirmRemove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
