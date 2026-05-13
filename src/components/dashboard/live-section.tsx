import type { LiveMatchView, UpcomingHeroView } from "@/server/dashboard/types";
import { useTranslations } from "next-intl";
import { LiveCard } from "./live-card";
import { UpcomingHeroCard } from "./upcoming-hero-card";

type Props = {
  live: LiveMatchView | null;
  nextMatch: UpcomingHeroView | null;
  /** Para tests: forzar el "now" usado en la fecha relativa. */
  now?: Date;
};

/**
 * Decide qué mostrar entre "En vivo ahora" y "Próximo partido".
 *
 * - Si `live` viene poblado → header rojo + live dot + LiveCard.
 * - Si no hay live pero sí `nextMatch` → header normal "Próximo
 *   partido" + UpcomingHeroCard.
 * - Si ambos son null → no se renderiza nada (la sección se omite).
 *
 * Esta lógica vive en un componente aparte para que el orquestador
 * `/inicio/page.tsx` no se complique con condicionales.
 */
export function LiveSection({ live, nextMatch, now }: Props) {
  const t = useTranslations("dashboard.sections");

  if (live === null && nextMatch === null) return null;

  return (
    <>
      <SectionLabel title={live ? t("live") : t("next")} tone={live ? "danger" : "gold"} />
      {live ? (
        <LiveCard live={live} />
      ) : nextMatch ? (
        <UpcomingHeroCard next={nextMatch} now={now} />
      ) : null}
    </>
  );
}

function SectionLabel({ title, tone }: { title: string; tone: "danger" | "gold" }) {
  const toneClass = tone === "danger" ? "text-danger" : "text-gold";
  return (
    <div className="my-3.5 flex items-center gap-2.5 [animation:fadeUp_0.4s_ease_forwards] opacity-0">
      <div className="h-px flex-1 bg-border" />
      {tone === "danger" && (
        <span
          aria-hidden="true"
          className="h-2 w-2 flex-shrink-0 rounded-full bg-danger motion-safe:animate-[blink_1.6s_ease_infinite]"
        />
      )}
      <span className={`font-display text-[13px] uppercase tracking-[0.12em] ${toneClass}`}>
        {title}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
