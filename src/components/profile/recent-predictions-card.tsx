import { useTranslations } from "next-intl";
import { HistoryEntryCard } from "@/components/history/history-entry-card";
import { Link } from "@/i18n/navigation";
import type { HistoryEntry } from "@/server/history/types";

type Props = {
  entries: HistoryEntry[];
};

/**
 * Caja "Tus últimas predicciones" en el perfil propio. Muestra las
 * 5 más recientes con su resultado y un CTA "Ver historial completo"
 * que enlaza a `/historial`.
 *
 * Si el user aún no ha predicho nada, no renderizamos la caja
 * (vacío → no añade valor en el perfil del dueño).
 */
export function RecentPredictionsCard({ entries }: Props) {
  const t = useTranslations("profileEditor.recentPredictions");
  if (entries.length === 0) return null;

  return (
    <section
      aria-label={t("title")}
      className="mt-4 rounded-2xl border-2 border-border bg-card p-4"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-gold">
          📜 {t("title")}
        </h2>
        <Link
          href="/historial"
          className="cursor-pointer text-[11px] font-extrabold text-gold no-underline transition-[gap] hover:gap-2"
        >
          {t("seeMore")} →
        </Link>
      </header>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {entries.map((entry) => (
          <li key={entry.matchId}>
            <HistoryEntryCard entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}
