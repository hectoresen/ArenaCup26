import { getAvatar } from "@/server/profile/avatars";
import { useTranslations } from "next-intl";

type Props = {
  identity: {
    name: string;
    flag: string | null;
    avatarId: string | null;
    image: string | null;
  };
};

/**
 * Cartel "Perfil privado". Lo renderiza `/u/<username>` cuando el
 * owner tiene `visibility` ≠ `'public'` y el viewer no puede verlo.
 *
 * Mostramos lo mínimo para que el visitante entienda que el perfil
 * existe (el ranking se lo mostró) pero el dueño ha decidido no
 * compartir el resto. No usamos `notFound()` porque eso confundiría:
 * el user existe, simplemente está cerrado.
 */
export function PrivateProfile({ identity }: Props) {
  const t = useTranslations("publicProfile.private");
  const galleryAvatar = getAvatar(identity.avatarId);
  const initial = (identity.name?.[0] ?? "?").toUpperCase();

  return (
    <article
      aria-label={t("title")}
      className="relative overflow-hidden rounded-3xl border-2 border-border bg-card px-6 py-10 text-center"
    >
      <div className="relative flex flex-col items-center gap-4">
        <span
          aria-hidden="true"
          className="inline-flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-border bg-card-hover font-display text-[28px] text-muted opacity-70"
        >
          {galleryAvatar ? (
            <span className="text-[36px] leading-none opacity-80">{galleryAvatar.emoji}</span>
          ) : identity.image ? (
            // biome-ignore lint/performance/noImgElement: small avatar
            // biome-ignore lint/a11y/useAltText: alt resolved by parent label
            <img
              src={identity.image}
              alt=""
              className="h-full w-full rounded-full object-cover opacity-60"
            />
          ) : (
            initial
          )}
        </span>

        <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.12em] text-muted">
          <span aria-hidden="true">🔒</span>
          {t("badge")}
        </div>

        <h1 className="font-display text-[22px] leading-tight text-foreground">{t("title")}</h1>
        <p className="max-w-xs text-[13px] font-bold leading-snug text-muted">{t("body")}</p>
      </div>
    </article>
  );
}
