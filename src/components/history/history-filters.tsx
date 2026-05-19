import { Link } from "@/i18n/navigation";
import type { HistoryOutcomeFilter } from "@/server/history/queries";
import { useTranslations } from "next-intl";

type Props = {
  active: HistoryOutcomeFilter;
  counts: {
    all: number;
    hit: number;
    miss: number;
    pending: number;
  };
};

/**
 * Chips de filtro del historial — URL-driven con `?outcome=...`.
 * Mismo patrón que `MatchesFiltersBar`: cada chip es un `<Link>` que
 * cambia el querystring y re-renderiza server-side. Sin estado
 * cliente, back/forward del navegador funciona, y los links son
 * compartibles.
 *
 * Cada chip incluye su contador del universo COMPLETO entre
 * paréntesis — el usuario sabe de antemano cuántas entradas verá
 * antes de clicar.
 */
export function HistoryFiltersBar({ active, counts }: Props) {
  const t = useTranslations("history.filters");

  const options: { value: HistoryOutcomeFilter; label: string; count: number }[] = [
    { value: "all", label: t("all"), count: counts.all },
    { value: "hit", label: t("hit"), count: counts.hit },
    { value: "miss", label: t("miss"), count: counts.miss },
    { value: "pending", label: t("pending"), count: counts.pending },
  ];

  return (
    <div className="mb-5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const href = opt.value === "all" ? "/historial" : `/historial?outcome=${opt.value}`;
          const isActive = active === opt.value;
          const isDisabled = opt.count === 0 && opt.value !== "all";
          if (isDisabled) {
            return (
              <span
                key={opt.value}
                aria-disabled="true"
                className="cursor-not-allowed rounded-full border-[1.5px] border-border/50 bg-card/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted/50"
              >
                {opt.label} <span className="opacity-60">({opt.count})</span>
              </span>
            );
          }
          return (
            <Link
              key={opt.value}
              href={href as never}
              aria-current={isActive ? "page" : undefined}
              className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] no-underline transition-colors ${
                isActive
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border bg-card text-muted hover:border-gold/30 hover:text-foreground"
              }`}
            >
              {opt.label} <span className="opacity-80">({opt.count})</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
