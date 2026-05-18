import { useTranslations } from "next-intl";
import { HistoryEntryCard } from "@/components/history/history-entry-card";
import { Link } from "@/i18n/navigation";
import type { HistoryEntry } from "@/server/history/types";

type Props = {
  entries: HistoryEntry[];
  /**
   * `owner` → mismo título "Tus últimas predicciones" + CTA "Ver
   * historial completo" hacia `/historial`. Default.
   * `visitor` → título neutro "Últimas predicciones" + sin CTA (los
   * visitantes no pueden ir al historial completo de otro user).
   */
  viewer?: "owner" | "visitor";
};

/**
 * Caja con las últimas predicciones. Reutilizable:
 *  - En el perfil del dueño (`viewer="owner"`): título "Tus últimas
 *    predicciones" + CTA hacia `/historial`.
 *  - En perfiles públicos visitando a otro user (`viewer="visitor"`):
 *    título neutro + sin link a historial completo (privado).
 *
 * Si no hay predicciones, no renderiza nada.
 */
export function RecentPredictionsCard({ entries, viewer = "owner" }: Props) {
  const t = useTranslations("profileEditor.recentPredictions");
  if (entries.length === 0) return null;

  const title = viewer === "owner" ? t("title") : t("titleVisitor");

  return (
    <section
      aria-label={title}
      className="mt-4 rounded-2xl border-2 border-border bg-card p-4"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-gold">
          📜 {title}
        </h2>
        {viewer === "owner" && (
          <Link
            href="/historial"
            className="cursor-pointer text-[11px] font-extrabold text-gold no-underline transition-[gap] hover:gap-2"
          >
            {t("seeMore")} →
          </Link>
        )}
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
