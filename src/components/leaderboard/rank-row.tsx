import type { Player } from "@/lib/leaderboard/types";

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

export function RankRow({ player, index = 0 }: { player: Player; index?: number }) {
  const delta = player.previousRank - player.rank;
  const hot = player.streak >= 3;
  const animationDelay = `${(index * 0.065 + 0.3).toFixed(2)}s`;
  const ariaLabel = [
    `Posición ${player.rank}`,
    `${player.name}, ${player.countryName}`,
    `${player.points} puntos`,
    hot ? `racha de ${player.streak}` : null,
    `${player.correctCount} predicciones acertadas`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      style={{ animationDelay }}
      aria-label={ariaLabel}
      className="group relative grid cursor-default grid-cols-[44px_1fr_auto] items-center gap-2.5 overflow-hidden rounded-[13px] border-2 border-border bg-card px-3.5 py-[11px] opacity-0 transition-[transform,border-color,background-color] duration-200 animate-[slideIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)_forwards] hover:translate-x-1 hover:border-gold/20 hover:bg-card-hover"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-[2px] bg-border transition-colors group-hover:bg-gold"
      />
      <div className="flex flex-col items-center justify-center gap-px">
        <span className="font-display text-xl leading-none text-foreground">{player.rank}</span>
        <span aria-hidden="true" className={`text-[9px] font-black leading-none ${deltaClass(delta)}`}>
          {arrow(delta)}
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-foreground">
          <span className="mr-1" aria-label={player.countryName}>
            {player.flag}
          </span>
          {player.name}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={`text-[11px] font-bold ${hot ? "text-warm" : "text-muted"}`}>
            {player.streak >= 3 ? `🔥 ×${player.streak}` : "sin racha"}
          </span>
          <span className="rounded border border-info/25 bg-info/10 px-[5px] py-px text-[9px] font-extrabold uppercase tracking-[0.06em] text-info">
            ✓ {player.correctCount} acertadas
          </span>
        </div>
      </div>
      <div className="text-right">
        <span className="block font-display text-[22px] leading-none text-foreground">
          {player.points.toLocaleString("es-ES")}
        </span>
        <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted">pts</span>
      </div>
    </div>
  );
}
