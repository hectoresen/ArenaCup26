"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CountryFlag } from "@/components/common/country-flag";
import { getAvatar } from "@/server/profile/avatars";
import { acceptFriendRequest, rejectFriendRequest } from "@/server/friends/actions";
import type { FriendRequest } from "@/server/friends/types";

type Props = {
  requests: FriendRequest[];
};

/**
 * Bandeja de solicitudes recibidas. Cada fila tiene avatar + nombre +
 * @username y dos botones "Aceptar" / "Rechazar". Optimista: la fila
 * desaparece tras el click; si la action falla, se re-añade.
 */
export function FriendRequestsInbox({ requests }: Props) {
  const t = useTranslations("friends.inbox");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visible = requests.filter((r) => !hidden.has(r.friendshipId));
  if (visible.length === 0) return null;

  function decide(id: string, fn: (id: string) => Promise<{ ok: boolean }>) {
    const previous = new Set(hidden);
    setHidden(new Set([...hidden, id]));
    startTransition(async () => {
      const result = await fn(id);
      if (!result.ok) setHidden(previous);
    });
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {visible.map((r) => {
        const galleryAvatar = getAvatar(r.fromAvatarId);
        return (
          <li
            key={r.friendshipId}
            className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-2.5"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold/30 bg-card-hover font-display text-base text-foreground"
            >
              {galleryAvatar ? (
                <span className="text-[20px] leading-none">{galleryAvatar.emoji}</span>
              ) : r.fromImage ? (
                // biome-ignore lint/performance/noImgElement: small avatar
                // biome-ignore lint/a11y/useAltText: alt resolved by parent label
                <img src={r.fromImage} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                (r.fromName?.[0] ?? "?").toUpperCase()
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-sm font-extrabold text-foreground">
                {r.fromName}
                {r.fromCountryCode && (
                  <CountryFlag
                    code={r.fromCountryCode}
                    name={r.fromCountryCode}
                    size={14}
                    className="flex-shrink-0 rounded-sm"
                  />
                )}
              </div>
              {r.fromUsername && (
                <div className="text-[11px] font-bold text-muted">@{r.fromUsername}</div>
              )}
            </div>

            <div className="flex flex-shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={isPending}
                onClick={() => decide(r.friendshipId, acceptFriendRequest)}
                className="cursor-pointer rounded-lg border-2 border-success/40 bg-success/10 px-3 py-1.5 text-[11px] font-extrabold text-success transition-colors hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("accept")}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => decide(r.friendshipId, rejectFriendRequest)}
                className="cursor-pointer rounded-lg border-2 border-border bg-card-hover px-3 py-1.5 text-[11px] font-extrabold text-muted transition-colors hover:bg-card-hover/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("reject")}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
