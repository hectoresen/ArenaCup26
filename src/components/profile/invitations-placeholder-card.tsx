import { useTranslations } from "next-intl";

type Props = {
  /** Número de invitaciones aceptadas. Placeholder 0 hasta fase 6. */
  count: number;
};

/**
 * Caja "Mis invitaciones" en el perfil del dueño. Por ahora es un
 * placeholder no funcional (la capability `add-social-invitations`
 * está en fase de análisis del roadmap, no implementación).
 *
 * Cuando un usuario invita a alguien y ese alguien se registra, se
 * cuenta aquí. Por ahora solo CTA "Invitar a un amigo" sin acción.
 */
export function InvitationsPlaceholderCard({ count }: Props) {
  const t = useTranslations("profileEditor.invitations");

  return (
    <section
      aria-label={t("title")}
      className="mt-4 rounded-2xl border-2 border-border bg-card p-4"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-gold">
          ✉️ {t("title")}
        </h2>
        <span className="rounded-full border-[1.5px] border-gold/30 bg-gold/[0.08] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-gold">
          {t("comingSoon")}
        </span>
      </header>
      {count === 0 ? (
        <p className="mb-3 text-[12px] font-bold leading-relaxed text-muted">
          {t("emptyBody")}
        </p>
      ) : (
        <p className="mb-3 text-[12px] font-bold leading-relaxed text-foreground">
          {t("countBody", { count })}
        </p>
      )}
      <button
        type="button"
        disabled
        className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full border-2 border-border bg-card-hover px-4 py-2 text-xs font-extrabold text-muted opacity-60"
      >
        {t("inviteCta")}
      </button>
    </section>
  );
}
