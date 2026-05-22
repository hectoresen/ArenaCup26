import type { BracketData, BracketRound } from "@/server/matches/types";
import { useTranslations } from "next-intl";
import { BracketCard } from "./bracket-card";

type Props = {
  bracket: BracketData;
  /** Para tests: forzar el "now". */
  now?: Date;
};

/**
 * Vista de eliminatorias del Mundial 2026. Secciones verticales una
 * por ronda (Octavos / Cuartos / Semis / 3er puesto / Final), cada
 * una con sus partidos en grid de 2 columnas mediante `<BracketCard>`.
 *
 * Si una ronda no tiene aún partidos sembrados, mostramos un
 * placeholder discreto en lugar de omitirla — el bracket completo
 * sirve de mapa visual del torneo aunque algunas rondas estén vacías.
 */
export function BracketView({ bracket, now }: Props) {
  const t = useTranslations("matches.bracket");
  return (
    <div className="flex flex-col gap-7">
      {bracket.rounds.map((group) => (
        <section key={group.round} aria-label={t(`rounds.${group.round}`)}>
          <header className="mb-2.5 flex items-center gap-2.5">
            <span aria-hidden="true" className="text-[14px] leading-none text-gold">
              ◈
            </span>
            <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
              {t(`rounds.${group.round}`)}
            </h2>
            <div className="h-px flex-1 bg-border" />
          </header>
          {group.matches.length === 0 ? (
            <EmptyRoundCard round={group.round} />
          ) : (
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 max-[420px]:grid-cols-1">
              {group.matches.map((match) => (
                <li key={match.matchId}>
                  <BracketCard match={match} now={now} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function EmptyRoundCard({ round }: { round: BracketRound }) {
  const t = useTranslations("matches.bracket");
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-card/40 px-4 py-6 text-center text-[11px] font-bold text-muted">
      {t("emptyRound", { round: t(`rounds.${round}`) })}
    </div>
  );
}
