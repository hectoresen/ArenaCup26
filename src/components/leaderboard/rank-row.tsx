import { CountryFlag } from "@/components/common/country-flag";
import { Link } from "@/i18n/navigation";
import { formatPointsEs } from "@/lib/format/number";
import type { Player } from "@/lib/leaderboard/types";
import { getAvatar } from "@/server/profile/avatars";
import { useTranslations } from "next-intl";

function arrow(delta: number) {
  if (delta > 0) return "▲";
  if (delta < 0) return "▼";
  return "·";
}

function deltaClass(delta: number) {
  if (delta > 0) return "text-success";
  if (delta < 0) return "text-danger";
  return "opacity-0";
}

export function RankRow({
  player,
  index = 0,
  nameSuffix,
}: {
  player: Player;
  index?: number;
  /**
   * Slot opcional renderizado a la derecha del nombre. Útil para
   * etiquetar al jugador con contexto extra (ej. "Ha salido" cuando
   * el ranking del grupo muestra ex-miembros congelados).
   */
  nameSuffix?: React.ReactNode;
}) {
  const t = useTranslations("leaderboard.row");
  const delta = player.previousRank - player.rank;
  const hot = player.streak >= 3;
  const animationDelay = `${(index * 0.065 + 0.3).toFixed(2)}s`;

  const baseAria = t("ariaPosition", {
    rank: player.rank,
    name: player.name,
    country: player.countryName,
    points: player.points,
  });
  const streakAria = hot ? `, ${t("ariaStreak", { count: player.streak })}` : "";
  const correctAria = `, ${t("ariaCorrect", { count: player.correctCount })}`;

  const cursorClass = player.username ? "cursor-pointer" : "cursor-default";
  const cardClass = `group relative grid grid-cols-[44px_36px_1fr_auto] items-center gap-2.5 overflow-hidden rounded-[13px] border-2 border-border bg-card px-3.5 py-[11px] opacity-0 transition-[transform,border-color,background-color] duration-200 animate-[slideIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)_forwards] hover:translate-x-1 hover:border-gold/20 hover:bg-card-hover no-underline text-inherit ${cursorClass}`;

  const galleryAvatar = getAvatar(player.avatarId);

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="absolute bottom-0 start-0 top-0 w-[3px] rounded-s-[2px] bg-border transition-colors group-hover:bg-gold"
      />
      <div className="flex flex-col items-center justify-center gap-px">
        <span className="font-display text-xl leading-none text-foreground">{player.rank}</span>
        <span
          aria-hidden="true"
          className={`text-[9px] font-black leading-none ${deltaClass(delta)}`}
        >
          {arrow(delta)}
        </span>
      </div>
      {/* Avatar circle 32px. SVG si avatarId resuelve, foto Google si
          no, fallback a iniciales. El indicador online se pega abajo
          a la derecha — vive como hermano del círculo (no descendiente)
          para que `overflow-hidden` del círculo no recorte el dot. */}
      <span className="relative h-8 w-8 shrink-0">
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-border bg-card-hover font-display text-[10px] text-muted">
          {galleryAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={galleryAvatar.src} alt="" className="h-full w-full object-cover" />
          ) : player.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.image} alt="" className="h-full w-full object-cover" />
          ) : (
            (player.name?.[0] ?? "?").toUpperCase()
          )}
        </span>
        {player.isOnline && (
          <span
            aria-label="Online"
            title="Online"
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-card bg-success"
          />
        )}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate text-sm font-extrabold text-foreground">
          <CountryFlag
            code={player.countryCode}
            name={player.countryName}
            size={14}
            className="flex-shrink-0 rounded-sm"
          />
          <span className="truncate">{player.name}</span>
          {nameSuffix}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={`text-[11px] font-bold ${hot ? "text-warm" : "text-muted"}`}>
            {player.streak >= 3 ? `🔥 ×${player.streak}` : t("noStreak")}
          </span>
          <span className="rounded border border-info/25 bg-info/10 px-[5px] py-px text-[9px] font-extrabold uppercase tracking-[0.06em] text-info">
            ✓ {t("correctBadge", { count: player.correctCount })}
          </span>
        </div>
      </div>
      <div className="text-end">
        <span className="block font-display text-[22px] leading-none text-foreground">
          {formatPointsEs(player.points)}
        </span>
        <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted">
          {t("pts")}
        </span>
      </div>
    </>
  );

  // Si tenemos username, el row entero es un Link a `/u/<username>`.
  // En otro caso (legacy data), queda como un div decorativo no
  // clicable — preferible a un Link que iría a /u/null.
  if (player.username) {
    return (
      <Link
        href={`/u/${player.username}`}
        style={{ animationDelay }}
        aria-label={baseAria + streakAria + correctAria}
        className={cardClass}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      style={{ animationDelay }}
      aria-label={baseAria + streakAria + correctAria}
      className={cardClass}
    >
      {inner}
    </div>
  );
}
