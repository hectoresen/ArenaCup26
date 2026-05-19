"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { joinGroupViaLink } from "@/server/groups/membership";

type Props = {
  token: string;
  groupId: string;
};

export function JoinViaLinkButton({ token, groupId }: Props) {
  const router = useRouter();
  const t = useTranslations("groups.joinLink");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle() {
    setError(null);
    startTransition(async () => {
      const res = await joinGroupViaLink(token);
      if (!res.ok) {
        const key =
          res.code === "cap_groups_reached"
            ? "error.capReached"
            : res.code === "group_full"
              ? "error.groupFull"
              : res.code === "link_revoked"
                ? "error.revoked"
                : res.code === "link_exhausted"
                  ? "error.exhausted"
                  : res.code === "group_deleted"
                    ? "error.groupDeleted"
                    : "error.generic";
        setError(t(key));
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
        className="cursor-pointer w-full rounded-full bg-gold py-3 font-display text-[13px] uppercase tracking-[0.12em] text-background hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? t("joining") : t("join")}
      </button>
      {error && (
        <div className="mt-3 rounded-2xl border-2 border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-300">
          {error}
        </div>
      )}
    </>
  );
}
