"use client";

import { leaveGroup } from "@/server/groups/membership";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  groupId: string;
  groupName: string;
};

export function LeaveGroupButton({ groupId, groupName }: Props) {
  const router = useRouter();
  const t = useTranslations("groups.leave");
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
      setError(res.code === "is_admin_cannot_leave" ? t("error.adminBlocked") : t("error.generic"));
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer rounded-full border-2 border-border bg-card-hover px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-muted hover:border-red-500/40 hover:text-foreground"
      >
        {t("trigger")}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-3">
      <p className="mb-2 text-[12px] font-bold text-foreground">
        {t("confirmTitle", { name: groupName })}
      </p>
      <p className="mb-3 text-[11px] font-bold leading-snug text-muted">{t("confirmBody")}</p>
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
          {t("submit")}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="cursor-pointer rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-foreground"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
