import { HistoryEntryCard } from "@/components/history/history-entry-card";
import { Link } from "@/i18n/navigation";
import type { HistoryEntry } from "@/server/history/types";
import { useTranslations } from "next-intl";

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
 * Caja PLEGABLE con las últimas predicciones (acordeón nativo
 * `<details>`/`<summary>`, abierto por defecto). Mismo patrón que
 * el acordeón de logros del perfil público.
 *
 * El CTA "Ver historial completo" (solo para owner) navega a
 * `/historial` — el click en el `<Link>` NO dispara el toggle del
 * details porque los browsers respetan la navegación de los
 * elementos interactivos descendientes.
 *
 * Si no hay predicciones, no renderiza nada.
 */
export function RecentPredictionsCard({ entries, viewer = "owner" }: Props) {
  const t = useTranslations("profileEditor.recentPredictions");
  if (entries.length === 0) return null;

  const title = viewer === "owner" ? t("title") : t("titleVisitor");

  return (
    <details
      open
      aria-label={title}
      className="mt-4 group rounded-2xl border-2 border-border bg-card open:border-gold/30"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 transition-colors hover:bg-card-hover">
        <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-gold">
          📜 {title}
        </h2>
        <div className="flex items-center gap-3">
          {viewer === "owner" && (
            <Link
              href="/historial"
              className="cursor-pointer text-[11px] font-extrabold text-gold no-underline transition-[gap] hover:gap-2"
            >
              {t("seeMore")} →
            </Link>
          )}
          <span
            aria-hidden="true"
            className="font-display text-base text-muted transition-transform group-open:rotate-90"
          >
            ›
          </span>
        </div>
      </summary>

      <div className="border-t border-border px-4 py-4">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {entries.map((entry) => (
            <li key={entry.matchId}>
              <HistoryEntryCard entry={entry} />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
