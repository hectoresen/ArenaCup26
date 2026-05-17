import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type Props = {
  /** Número de invitaciones aceptadas (redenciones que dispararon
   *  auto-friendship). Se muestra solo si > 0. */
  count: number;
};

/**
 * Caja "Mis invitaciones" en el perfil del dueño. Enlaza a la
 * sección `#invitaciones` de `/amigos`, donde vive la gestión real
 * de links (capability F4 del roadmap, 2026-05-16).
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
      <Link
        href="/amigos#invitaciones"
        className="inline-flex w-full cursor-pointer items-center justify-center rounded-full border-2 border-gold/40 bg-gold/10 px-4 py-2 text-xs font-extrabold text-gold no-underline transition-colors hover:bg-gold/15"
      >
        {t("inviteCta")}
      </Link>
    </section>
  );
}
