import type { GroupRankingEntry } from "@/server/groups/types";
import { CountryFlag } from "@/components/common/country-flag";
import { Link } from "@/i18n/navigation";
import { getAvatar } from "@/server/profile/avatars";

function AvatarBadge({ avatarId, image }: { avatarId: string | null; image: string | null }) {
  const avatar = getAvatar(avatarId);
  if (avatar) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-hover text-[18px]">
        {avatar.emoji}
      </span>
    );
  }
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return <span className="h-9 w-9 shrink-0 rounded-full bg-card-hover" />;
}

type Props = {
  entries: GroupRankingEntry[];
  viewerUserId: string | null;
};

/**
 * Listado del ranking de un grupo. Muestra rank, avatar, nombre,
 * país, puntos, racha, y badge "ex-miembro" si `frozen`. Las filas
 * son links a `/u/<username>` cuando el username está set.
 *
 * El viewer se resalta visualmente con borde gold para localizarse
 * rápido en grupos grandes.
 */
export function GroupRankingList({ entries, viewerUserId }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-6 text-center text-[12px] font-bold text-muted">
        Aún no hay miembros en el ranking. Cuando alguien acierte una
        predicción aparecerá aquí.
      </div>
    );
  }
  return (
    <ol className="space-y-1.5">
      {entries.map((e) => {
        const isMe = viewerUserId === e.userId;
        const profileHref = e.username ? `/u/${e.username}` : null;
        const content = (
          <div
            className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 transition-colors ${
              isMe
                ? "border-gold/60 bg-gold/[0.06]"
                : e.frozen
                  ? "border-border bg-card/60 opacity-70"
                  : "border-border bg-card hover:border-gold/30"
            }`}
          >
            <span
              className={`shrink-0 font-display text-[15px] tabular-nums ${
                e.rank === 1
                  ? "text-gold"
                  : e.rank <= 3
                    ? "text-foreground"
                    : "text-muted"
              }`}
            >
              {e.rank}
            </span>
            <AvatarBadge avatarId={e.avatarId} image={e.image} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-display text-[14px] text-foreground">
                  {e.name}
                </span>
                {e.countryCode && <CountryFlag code={e.countryCode} size={14} />}
                {e.frozen && (
                  <span className="rounded-full border border-border bg-card-hover/60 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-muted">
                    Ex
                  </span>
                )}
                {isMe && (
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-gold">
                    Tú
                  </span>
                )}
              </div>
              {e.username && (
                <div className="truncate text-[11px] font-bold text-muted">@{e.username}</div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="font-display text-[15px] tabular-nums text-foreground">
                {e.points}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                pts
              </div>
            </div>
          </div>
        );
        return (
          <li key={e.userId}>
            {profileHref ? (
              <Link href={profileHref} className="block">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
