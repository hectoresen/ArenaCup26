import { Link } from "@/i18n/navigation";
import type { MatchesFilters } from "@/server/matches/types";
import { useTranslations } from "next-intl";

type Props = {
  active: MatchesFilters;
  /** Total de partidos tras aplicar los filtros actuales. */
  count: number;
};

/**
 * Chips de filtro para `/partidos` (vista "Todos"). Cada chip cambia
 * el querystring `?` y vuelve a renderizar la página server-side —
 * sin estado cliente, back/forward del navegador funcionan y se
 * puede compartir un link con los filtros aplicados.
 *
 * Grupos:
 *  - **Estado**: Todos / En vivo / Pronto / Acabados.
 *  - **Fase**: Todos / Grupos / Eliminatoria.
 *  - **Predicciones**: Todos / Solo predichos.
 *
 * El total resultante (`count`) aparece como mini-badge a la derecha.
 */
export function MatchesFiltersBar({ active, count }: Props) {
  const t = useTranslations("matches.filters");

  return (
    <div className="mb-5 space-y-2">
      <FilterGroup
        label={t("statusLegend")}
        options={[
          { value: "all", label: t("status.all") },
          { value: "live", label: t("status.live") },
          { value: "scheduled", label: t("status.scheduled") },
          { value: "finished", label: t("status.finished") },
        ]}
        active={active.status}
        param="status"
        current={active}
      />
      <FilterGroup
        label={t("stageLegend")}
        options={[
          { value: "all", label: t("stage.all") },
          { value: "group", label: t("stage.group") },
          { value: "knockout", label: t("stage.knockout") },
        ]}
        active={active.stage}
        param="stage"
        current={active}
      />
      <FilterGroup
        label={t("predictedLegend")}
        options={[
          { value: "false", label: t("predicted.all") },
          { value: "true", label: t("predicted.yes") },
        ]}
        active={active.predictedOnly ? "true" : "false"}
        param="mias"
        current={active}
      />
      <div className="pt-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
        {t("resultCount", { count })}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  active,
  param,
  current,
}: {
  label: string;
  options: { value: string; label: string }[];
  active: string;
  param: "status" | "stage" | "mias";
  current: MatchesFilters;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const href = buildHref(param, opt.value, current);
          const isActive = active === opt.value;
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
              {opt.label}
            </Link>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Construye `/partidos?…` preservando los filtros actuales y solo
 * cambiando el param indicado. Si el nuevo valor es el default
 * (`"all"` o `predictedOnly=false`), omite el param para que la URL
 * quede limpia.
 */
function buildHref(
  param: "status" | "stage" | "mias",
  newValue: string,
  current: MatchesFilters,
): string {
  const sp = new URLSearchParams();

  const status = param === "status" ? newValue : current.status;
  const stage = param === "stage" ? newValue : current.stage;
  const mias = param === "mias" ? newValue : current.predictedOnly ? "true" : "false";

  if (status !== "all") sp.set("status", status);
  if (stage !== "all") sp.set("stage", stage);
  if (mias === "true") sp.set("mias", "true");

  const qs = sp.toString();
  return qs ? `/partidos?${qs}` : "/partidos";
}
