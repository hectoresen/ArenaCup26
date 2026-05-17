"use client";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CountryFlag } from "@/components/common/country-flag";
import { Link } from "@/i18n/navigation";
import { removeFriend } from "@/server/friends/actions";
import { getAvatar } from "@/server/profile/avatars";
import type { Friend } from "@/server/friends/types";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

type Props = {
  friends: Friend[];
};

/**
 * Lista de amigos del user. Cada fila enlaza a `/u/<username>`
 * (cuando el username está set) y además expone un botón × para
 * eliminar la amistad sin tener que ir al perfil. La eliminación es
 * recíproca por diseño de schema: borrar la fila en `friendships`
 * afecta a ambos lados, no hace falta dos statements.
 *
 * Optimistic UI: el amigo desaparece del listado al instante. Si la
 * server action falla, restauramos.
 */
export function FriendsList({ friends: initial }: Props) {
  const t = useTranslations("friends.list");
  const tCommon = useTranslations("common.confirm");
  const [friends, setFriends] = useState<Friend[]>(initial);
  const [pendingRemove, setPendingRemove] = useState<Friend | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmRemove() {
    if (!pendingRemove) return;
    const target = pendingRemove;
    const previous = friends;
    setFriends((prev) => prev.filter((x) => x.userId !== target.userId));
    setPendingRemove(null);
    startTransition(async () => {
      const result = await removeFriend(target.userId);
      if (!result.ok) {
        setFriends(previous);
      }
    });
  }

  if (friends.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-6 text-center text-[12px] font-bold text-muted">
        {t("empty")}
      </div>
    );
  }

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {friends.map((f) => (
          <FriendRow
            key={f.userId}
            friend={f}
            onRemove={() => setPendingRemove(f)}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={pendingRemove !== null}
        title={t("removeTitle")}
        body={
          pendingRemove
            ? t("removeBody", { name: pendingRemove.name })
            : ""
        }
        confirmLabel={t("removeCta")}
        cancelLabel={tCommon("cancel")}
        variant="danger"
        isPending={isPending}
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </>
  );
}

function FriendRow({ friend: f, onRemove }: { friend: Friend; onRemove: () => void }) {
  const t = useTranslations("friends.list");
  const galleryAvatar = getAvatar(f.avatarId);

  const body = (
    <>
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold/30 bg-card-hover font-display text-base text-foreground"
      >
        {galleryAvatar ? (
          <span className="text-[20px] leading-none">{galleryAvatar.emoji}</span>
        ) : f.image ? (
          // biome-ignore lint/performance/noImgElement: small avatar
          // biome-ignore lint/a11y/useAltText: alt resolved by parent label
          <img src={f.image} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          (f.name?.[0] ?? "?").toUpperCase()
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-sm font-extrabold text-foreground">
          {f.name}
          {f.countryCode && (
            <CountryFlag
              code={f.countryCode}
              name={f.countryCode}
              size={14}
              className="flex-shrink-0 rounded-sm"
            />
          )}
        </div>
        {f.username && <div className="text-[11px] font-bold text-muted">@{f.username}</div>}
      </div>
      <div className="flex-shrink-0 text-end">
        <span className="block font-display text-[15px] leading-none text-gold">{f.points}</span>
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-muted">
          {t("pts")}
        </span>
      </div>
    </>
  );

  // Botón × stop-propagation para que un click en él NO navegue al
  // perfil cuando la fila es un <Link>. Aria-label sí coge el nombre
  // del amigo para que screen readers anuncien la acción claramente.
  const removeBtn = (
    <button
      type="button"
      aria-label={t("removeAria", { name: f.name })}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }}
      className="flex-shrink-0 cursor-pointer rounded-lg border-2 border-border bg-card-hover p-1.5 text-muted transition-colors hover:border-danger/40 hover:text-danger"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" />
        <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" />
      </svg>
    </button>
  );

  if (f.username) {
    return (
      <li className="flex items-center gap-2">
        <Link
          href={`/u/${f.username}` as never}
          className="flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-2.5 no-underline transition-[border-color,transform] hover:-translate-y-[1px] hover:border-gold/30"
        >
          {body}
        </Link>
        {removeBtn}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-2.5">
        {body}
      </div>
      {removeBtn}
    </li>
  );
}
