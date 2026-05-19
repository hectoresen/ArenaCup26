import { Link } from "@/i18n/navigation";
import type { MatchesFilters } from "@/server/matches/types";
import { useTranslations } from "next-intl";

type Props = {
  active: MatchesFilters;
  /** Total de partidos tras aplicar los filtros actuales. */
  count: number;
};

/**
 * Filtros de `/partidos` (vista "Todos"). Cambian el querystring `?` y
 * re-renderizan server-side — sin estado cliente, back/forward del
 * navegador funciona y los links con filtros son compartibles.
 *
 * UI actual (rediseño 2026-05-19):
 *  - **Estado** (radio): Todos / En vivo / Pronto / Acabados.
 *  - **Mis predicciones** (toggle): ON/OFF. Filtro adicional sobre
 *    el estado seleccionado. Cuando ON, la URL lleva `?mias=true`.
 *
 * El filtro de **fase** (Grupos/Eliminatoria) está temporalmente
 * oculto — el dominio sigue soportándolo en `MatchesFilters` para
 * re-activarlo sin migración cuando el Mundial alcance octavos.
 *
 * El total resultante (`count`) aparece como mini-badge al final.
 */
export function MatchesFiltersBar({ active, count }: Props) {
  const t = useTranslations("matches.filters");

  return (
    <div className="mb-5 space-y-3">
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

      <PredictedToggle active={active.predictedOnly} current={active} />

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
  param: "status" | "stage";
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
 * Toggle único "Mis predicciones". Distinct visually del grupo
 * `Estado` para comunicar "esto es un filtro EXTRA, no una pestaña
 * exclusiva". Cuando está ON muestra check `✓`; cuando está OFF,
 * círculo vacío.
 */
function PredictedToggle({
  active,
  current,
}: {
  active: boolean;
  current: MatchesFilters;
}) {
  const t = useTranslations("matches.filters");
  const href = buildHref("mias", active ? "false" : "true", current);
  return (
    <Link
      href={href as never}
      role="switch"
      aria-checked={active}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] no-underline transition-colors ${
        active
          ? "border-gold bg-gold/15 text-gold"
          : "border-border bg-card text-muted hover:border-gold/30 hover:text-foreground"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] text-[10px] leading-none ${
          active ? "border-gold bg-gold text-background" : "border-border bg-card"
        }`}
      >
        {active ? "✓" : ""}
      </span>
      {t("predictedToggle")}
    </Link>
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
