import type { HistoryEntry } from "@/server/history/types";
import { EmptyHistoryState } from "./empty-history-state";
import { HistoryEntryCard } from "./history-entry-card";

type Props = {
  entries: HistoryEntry[];
  now?: Date;
};

/**
 * Lista de entradas del historial. Si no hay nada, renderiza el
 * empty state. Sin agrupación por día — el orden cronológico
 * descendente del query ya basta para "lo más reciente primero".
 */
export function HistoryList({ entries, now }: Props) {
  if (entries.length === 0) {
    return <EmptyHistoryState />;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {entries.map((entry) => (
        <li key={entry.matchId}>
          <HistoryEntryCard entry={entry} now={now} />
        </li>
      ))}
    </ul>
  );
}
