import { CountryFlag } from "@/components/common/country-flag";
import { Link } from "@/i18n/navigation";
import { getAvatar } from "@/server/profile/avatars";
import type { Friend } from "@/server/friends/types";
import { useTranslations } from "next-intl";

type Props = {
  friends: Friend[];
};

/**
 * Lista de amigos del user. Si está vacía muestra un placeholder.
 * Cada fila enlaza a `/u/<username>` (cuando el username está set —
 * los users sin username completado aún no son linkable).
 */
export function FriendsList({ friends }: Props) {
  const t = useTranslations("friends.list");
  if (friends.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-6 text-center text-[12px] font-bold text-muted">
        {t("empty")}
      </div>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {friends.map((f) => {
        const galleryAvatar = getAvatar(f.avatarId);
        const Body = (
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
              <span className="block font-display text-[15px] leading-none text-gold">
                {f.points}
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-muted">
                {t("pts")}
              </span>
            </div>
          </>
        );
        return (
          <li key={f.userId}>
            {f.username ? (
              <Link
                href={`/u/${f.username}` as never}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-2.5 no-underline transition-[border-color,transform] hover:-translate-y-[1px] hover:border-gold/30"
              >
                {Body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-2.5">
                {Body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
