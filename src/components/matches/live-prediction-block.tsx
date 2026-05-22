import type { PredictionView } from "@/server/dashboard/types";
import { useTranslations } from "next-intl";

type Provisional = {
  points: number;
  kind: "simple" | "exact" | "double" | "miss" | "voided";
} | null;

type Props = {
  /** Nombre del equipo local — necesario para etiquetar la predicción. */
  homeName: string;
  /** Nombre del equipo visitante. */
  awayName: string;
  /** Predicción del viewer para este partido. */
  prediction: PredictionView;
  /**
   * Puntos provisionales si el partido acabara con el marcador actual.
   * `null` si no hay scores todavía (kickoff sin minuto 1) o si el
   * engine no infiere nada.
   */
  provisional: Provisional;
};

/**
 * Bloque compartido entre la `LiveCard` del dashboard y la página de
 * detalle del partido (`/partidos/[id]`) cuando el partido está en
 * juego. Lo extraemos en un componente propio para que ambas
 * superficies muestren EXACTAMENTE la misma información — incluido el
 * tono del copy "vas ganando" / "aún no, pero...".
 *
 * Diseño:
 *  - Etiqueta "Tu predicción" + valor (nombre de equipo / marcador).
 *  - Bloque de puntos a la derecha con un emoji por tipo de scoring.
 *  - **Microcopy emocional**: una sola línea con color que refleja
 *    si el viewer está ganando provisionalmente o no, con guiño
 *    futbolero (no rendirse hasta el pitido final).
 */
export function LivePredictionBlock({ homeName, awayName, prediction, provisional }: Props) {
  const t = useTranslations("dashboard.live");

  const label =
    prediction.kind === "exact"
      ? `${homeName} ${prediction.predictedHomeScore ?? 0} – ${prediction.predictedAwayScore ?? 0} ${awayName}`
      : prediction.predictedWinner === "home"
        ? homeName
        : prediction.predictedWinner === "away"
          ? awayName
          : t("draw");

  const winning =
    provisional !== null && provisional.kind !== "miss" && provisional.kind !== "voided";

  const provEmoji =
    provisional?.kind === "exact"
      ? "💎"
      : provisional?.kind === "simple"
        ? "🎯"
        : provisional?.kind === "double"
          ? "⚡"
          : "❌";

  return (
    <div
      className={`mt-3.5 rounded-xl border-[1.5px] px-3.5 py-3 ${
        winning ? "border-success/30 bg-success/[0.08]" : "border-border bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="mb-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-muted">
            {t("yourPrediction")}
          </div>
          <div className="font-display text-base text-foreground">{label}</div>
        </div>
        <div className="text-right">
          {provisional ? (
            <>
              <span
                className={`block font-display text-xl leading-none ${
                  winning ? "text-success" : "text-muted"
                }`}
              >
                {provEmoji} {winning ? `+${provisional.points}` : "0"} {t("pts")}
              </span>
              <span
                aria-label={t("provisional")}
                className="mt-1 inline-flex items-center gap-1 rounded-md border-[1.5px] border-info/30 bg-info/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-info"
              >
                {t("provisional")}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-muted">
              {t("computedAtEnd")}
            </span>
          )}
        </div>
      </div>

      {/* Microcopy emocional: SOLO cuando hay provisional ya calculado
          (el partido tiene minutos y marcador). Si va ganando, lo
          celebramos; si no, levantamos el ánimo recordándole el pitido
          final. La línea se reserva siempre en su zona — no flotamos
          fuera del bloque. */}
      {provisional && (
        <div
          className={`mt-2.5 border-t pt-2 text-[11px] font-extrabold leading-snug ${
            winning ? "border-success/20 text-success" : "border-border text-warm"
          }`}
        >
          {winning ? t("winningNow", { points: provisional.points }) : t("missingNow")}
        </div>
      )}
    </div>
  );
}
