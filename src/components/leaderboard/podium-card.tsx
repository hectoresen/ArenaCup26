import { useTranslations } from "next-intl";
import type { Player } from "@/lib/leaderboard/types";

type Place = 1 | 2 | 3;

const TONE: Record<
  Place,
  {
    container: string;
    border: string;
    badge: string;
    avatar: string;
    points: string;
    label: string;
  }
> = {
  1: {
    container:
      "bg-gradient-to-br from-[#1e1a08] to-[#14120a] pt-5 shadow-[0_0_32px_rgba(245,200,66,0.18),inset_0_1px_0_rgba(245,200,66,0.12)]",
    border: "border-gold",
    badge: "bg-gold text-[#1a1000]",
    avatar: "bg-gradient-to-br from-[#ffe066] to-[#c8900a] text-[#1a1000]",
    points: "text-gold drop-shadow-[0_2px_8px_rgba(245,200,66,0.4)]",
    label: "1º",
  },
  2: {
    container:
      "bg-gradient-to-br from-[#141e2a] to-[#0e1620] shadow-[0_0_16px_rgba(200,216,240,0.08)]",
    border: "border-silver/55",
    badge: "bg-silver text-[#0e1620]",
    avatar: "bg-gradient-to-br from-[#d8e8ff] to-[#8090b0] text-[#0e1620]",
    points: "text-silver",
    label: "2º",
  },
  3: {
    container:
      "bg-gradient-to-br from-[#1a1008] to-[#120e08] shadow-[0_0_16px_rgba(232,131,74,0.08)]",
    border: "border-bronze/60",
    badge: "bg-bronze text-[#1a0800]",
    avatar: "bg-gradient-to-br from-[#ffb870] to-[#b05020] text-[#1a0800]",
    points: "text-bronze",
    label: "3º",
  },
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PodiumCard({ player, place }: { player: Player; place: Place }) {
  const t = useTranslations("leaderboard.podium");
  const tone = TONE[place];
  return (
    <div
      className={`relative cursor-default overflow-hidden rounded-2xl border-[2.5px] px-2.5 pb-3.5 pt-3.5 text-center transition-transform duration-200 hover:-translate-y-1.5 hover:scale-[1.03] ${tone.container} ${tone.border}`}
      aria-label={t("ariaPosition", {
        place,
        name: player.name,
        country: player.countryName,
        points: player.points,
      })}
    >
      {place === 1 && (
        <span
          aria-hidden="true"
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 animate-[ballSpin_4s_linear_infinite] text-2xl drop-shadow-[0_2px_8px_rgba(245,200,66,0.5)]"
        >
          ⚽
        </span>
      )}
      <span
        className={`absolute end-2 top-2 rounded-full px-1.5 py-0.5 font-display text-[10px] leading-[1.4] ${tone.badge}`}
      >
        {tone.label}
      </span>
      <div
        className={`mx-auto mb-1.5 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-black/35 font-display text-lg ${tone.avatar}`}
      >
        {initials(player.name)}
      </div>
      <span className="mb-1 block text-base" aria-label={player.countryName}>
        {player.flag}
      </span>
      <div className="mb-1.5 truncate text-[11px] font-extrabold text-foreground">
        {player.name.split(" ")[0] ?? player.name}
      </div>
      <span className={`block font-display text-2xl leading-none ${tone.points}`}>
        {player.points.toLocaleString("es-ES")}
      </span>
      <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted">
        {t("pointsLabel")}
      </div>
    </div>
  );
}
