import type { MatchGroup, MatchListItem } from "./types";

/**
 * Devuelve la fecha en formato `YYYY-MM-DD` en UTC. Sirve como
 * `dayKey` estable para agrupar partidos sin depender del runtime.
 */
export function utcDayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Agrupa una lista de partidos por día UTC del kickoff, ordenados
 * cronológicamente. Dentro de cada grupo, los partidos también van
 * ordenados ASC por kickoffAt.
 *
 * Asume que el input ya viene ordenado por kickoffAt. Si no, este
 * helper no lo reordena — el caller decide.
 */
export function groupMatchesByDay(matches: MatchListItem[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const match of matches) {
    const key = utcDayKey(match.kickoffAt);
    let group = groups.get(key);
    if (!group) {
      group = { dayKey: key, dayDate: match.kickoffAt, matches: [] };
      groups.set(key, group);
    }
    group.matches.push(match);
  }
  return [...groups.values()];
}
