"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  acceptGroupInvitation,
  rejectGroupInvitation,
} from "@/server/groups/invitations";
import type { GroupInvitationRow } from "@/server/groups/types";
import { GroupAvatar } from "./group-avatar";

type Props = {
  invitations: GroupInvitationRow[];
};

export function GroupInvitationsInbox({ invitations: initial }: Props) {
  const router = useRouter();
  const t = useTranslations("groups.invitationsInbox");
  const [items, setItems] = useState(initial);
  const [errored, setErrored] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAccept(inv: GroupInvitationRow) {
    const previous = items;
    setItems((arr) => arr.filter((x) => x.invitationId !== inv.invitationId));
    setErrored(null);
    startTransition(async () => {
      const res = await acceptGroupInvitation({ invitationId: inv.invitationId });
      if (!res.ok) {
        setItems(previous);
        setErrored(
          res.code === "group_full"
            ? t("error.groupFull", { name: inv.groupName })
            : res.code === "cap_groups_reached"
              ? t("error.capReached")
              : res.code === "group_deleted"
                ? t("error.groupDeleted")
                : t("error.acceptFailed"),
        );
        return;
      }
      router.push(`/social/grupos/${inv.groupId}`);
      router.refresh();
    });
  }

  function handleReject(inv: GroupInvitationRow) {
    const previous = items;
    setItems((arr) => arr.filter((x) => x.invitationId !== inv.invitationId));
    setErrored(null);
    startTransition(async () => {
      const res = await rejectGroupInvitation({ invitationId: inv.invitationId });
      if (!res.ok) {
        setItems(previous);
        setErrored(t("error.rejectFailed"));
      }
    });
  }

  if (items.length === 0 && !errored) return null;

  return (
    <div className="space-y-2">
      {errored && (
        <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-300">
          {errored}
        </div>
      )}
      {items.map((inv) => (
        <div
          key={inv.invitationId}
          className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-3"
        >
          <GroupAvatar color={inv.groupColor} name={inv.groupName} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[14px] text-foreground">
              {inv.groupName}
            </div>
            {inv.invitedByName && (
              <div className="text-[11px] font-bold text-muted">
                {t("invitedBy", { name: inv.invitedByName })}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => handleReject(inv)}
              disabled={isPending}
              className="cursor-pointer rounded-full border-2 border-border bg-card-hover px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-muted hover:border-red-500/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("reject")}
            </button>
            <button
              type="button"
              onClick={() => handleAccept(inv)}
              disabled={isPending}
              className="cursor-pointer rounded-full bg-gold px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-background hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("accept")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
