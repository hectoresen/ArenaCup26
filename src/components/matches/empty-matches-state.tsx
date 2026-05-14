import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Pantalla vacía de `/partidos` cuando la BD no tiene partidos (o
 * todos están fuera del filtro). Pensada para que un usuario final
 * NO vea jerga interna ("npm run fixtures", "sync manual con
 * API-Football", etc.) si se cuela una BD vacía en producción o el
 * provider falla durante unos minutos.
 *
 * Diseño coherente con el resto del shell: card grande con borde,
 * emoji decorativo, copy en jerarquía (título display + body muted)
 * y CTA al panel.
 */
export function EmptyMatchesState() {
  const t = useTranslations("matches.empty");

  return (
    <article
      aria-label={t("title")}
      className="relative overflow-hidden rounded-3xl border-2 border-border bg-card px-6 py-12 text-center [animation:fadeUp_0.55s_ease_0.06s_forwards] opacity-0"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(245,200,66,0.07)_0%,transparent_70%)]"
      />

      <div className="relative flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="relative inline-flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold/20 bg-gold/[0.06]"
        >
          <span className="motion-safe:animate-[trophyFloat_3.5s_ease-in-out_infinite] text-4xl leading-none">
            ⚽
          </span>
        </div>

        <h2 className="font-display text-[22px] leading-tight text-foreground">
          {t("title")}
        </h2>

        <p className="max-w-sm text-[13px] font-bold leading-relaxed text-muted">
          {t("body")}
        </p>

        <Link
          href="/inicio"
          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-gold/30 bg-card px-4 py-2 text-xs font-extrabold text-gold no-underline transition-colors hover:border-gold hover:bg-card-hover"
        >
          ← {t("cta")}
        </Link>
      </div>
    </article>
  );
}
