import type { ProfileIdentity } from "@/server/public-profile/types";
import { useTranslations } from "next-intl";
import { CopyLinkButton } from "./copy-link-button";

type Props = {
  identity: ProfileIdentity;
};

/**
 * Hero del perfil público: avatar con ring conic + nombre + handle +
 * country pill + botón "Copiar enlace". Centrado verticalmente sobre
 * un fondo de gradiente sutil.
 */
export function ProfileHero({ identity }: Props) {
  const t = useTranslations("publicProfile");
  const initial = (identity.name?.[0] ?? identity.username[0] ?? "?").toUpperCase();

  return (
    <article
      aria-label={t("identityLabel", { name: identity.name })}
      className="relative overflow-hidden rounded-3xl border-2 border-border bg-card px-6 py-7 text-center [animation:popIn_0.7s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(245,200,66,0.08)_0%,transparent_70%)]"
      />

      <div className="relative flex flex-col items-center gap-3">
        <span
          role="img"
          aria-label={t("avatarLabel", { name: identity.name })}
          className="inline-flex h-24 w-24 items-center justify-center rounded-full p-[3px] [background:conic-gradient(var(--color-gold)_0deg,var(--color-bronze)_120deg,var(--color-gold)_240deg,var(--color-gold-deep)_360deg)]"
        >
          <span className="inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] border-black/25 bg-[radial-gradient(135deg,#ffe066,#c8900a)] font-display text-[34px] text-[#1a1000]">
            {identity.image ? (
              <img
                src={identity.image}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              initial
            )}
          </span>
        </span>

        <div className="font-display text-[26px] leading-tight text-foreground">
          {identity.name}
        </div>
        <div className="-mt-1.5 text-[13px] font-extrabold tracking-wide text-muted">
          @{identity.username}
        </div>

        {identity.country && identity.flag && (
          <div
            aria-label={t("flagAria", { country: identity.country })}
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-border bg-card-hover px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-foreground"
          >
            <span aria-hidden="true" className="text-sm">
              {identity.flag}
            </span>
            {identity.country}
          </div>
        )}

        <CopyLinkButton />
      </div>
    </article>
  );
}
