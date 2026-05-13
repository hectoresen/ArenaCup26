import type { LeaderboardEntry, MiniLeaderboardView, UpcomingMatch } from "./types";

/**
 * Extrae el primer nombre para el saludo "Hola, <Nombre> 👋".
 *
 * - Toma la primera palabra no-vacía del nombre.
 * - Si el nombre viene null/undefined/vacío devuelve `null`, y el caller
 *   decide qué saludo neutro mostrar (e.g. "Bienvenido").
 */
export function firstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

/**
 * Verifica si un partido próximo está pendiente de bracket: equipos no
 * resueltos (típicamente semifinal antes de los cuartos finalizar).
 */
export function isMatchTBD(match: UpcomingMatch): boolean {
  return match.homeTeam === null || match.awayTeam === null;
}

/**
 * Ordena la lista de próximos por kickoff ASC, dejando los TBD al
 * final (porque su fecha puede ser cierta pero sin equipos no son
 * accionables).
 */
export function sortUpcomingMatches(matches: UpcomingMatch[]): UpcomingMatch[] {
  return [...matches].sort((a, b) => {
    const aTbd = isMatchTBD(a);
    const bTbd = isMatchTBD(b);
    if (aTbd && !bTbd) return 1;
    if (!aTbd && bTbd) return -1;
    return a.kickoffAt.getTime() - b.kickoffAt.getTime();
  });
}

/**
 * Construye la `MiniLeaderboardView` a partir del top global y la
 * fila del user. Si el user ya está en el top, `me` queda `null` para
 * que el componente no duplique la fila ni pinte el separador.
 */
export function buildMiniLeaderboard(
  top: LeaderboardEntry[],
  me: LeaderboardEntry | null,
): MiniLeaderboardView {
  if (!me) return { top, me: null };
  const meInTop = top.some((entry) => entry.userId === me.userId);
  return { top, me: meInTop ? null : me };
}

/**
 * El total de partidos que se muestran en la sección "Próximos
 * partidos". 5 es el número del mockup; centralizar evita drift
 * entre la query y el componente.
 */
export const UPCOMING_LIMIT = 5;
