import { CountryFlag } from "@/components/common/country-flag";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { EditableName } from "@/components/profile/editable-name";
import type { Division } from "@/lib/leaderboard/division";
import { getAvatar } from "@/server/profile/avatars";
import type { ProfileIdentity } from "@/server/public-profile/types";
import { useTranslations } from "next-intl";
import { CopyLinkButton } from "./copy-link-button";
import { DivisionMedal } from "./division-medal";

type Props = {
  identity: ProfileIdentity;
  /** True si el viewer es el dueño del perfil. Habilita editar. */
  isOwner?: boolean;
  /**
   * Cooldowns activos del owner para mostrar countdown en vez de
   * dejarle clicar y ver un toast post-mortem. Solo se pasan si
   * `isOwner` es true (los visitantes no necesitan saberlo).
   */
  cooldowns?: {
    nameCooldownRemainingMs: number;
    avatarCooldownRemainingMs: number;
  };
  /**
   * División actual del owner (derivada de su rank). `null` si está
   * fuera del top 30 → no se renderiza medalla. Ver
   * `docs/divisions.md` §Medalla en el perfil.
   */
  division?: Division | null;
};

/**
 * Hero del perfil público: avatar (foto Google o emoji de galería)
 * + nombre + handle + country pill + botón "Copiar enlace".
 *
 * Si `isOwner`, el avatar es clickable (abre <AvatarPicker>) y el
 * nombre también (<EditableName> inline). Ambos respetan cooldown
 * 48h vía server action.
 */
export function ProfileHero({ identity, isOwner = false, cooldowns, division = null }: Props) {
  const t = useTranslations("publicProfile");
  const initial = (identity.name?.[0] ?? identity.username[0] ?? "?").toUpperCase();
  const galleryAvatar = getAvatar(identity.avatarId);

  const avatarVisual = (
    <span className="relative inline-block">
      <span
        role="img"
        aria-label={t("avatarLabel", { name: identity.name })}
        className="inline-flex h-24 w-24 items-center justify-center rounded-full p-[3px] [background:conic-gradient(var(--color-gold)_0deg,var(--color-bronze)_120deg,var(--color-gold)_240deg,var(--color-gold-deep)_360deg)]"
      >
        <span className="inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] border-black/25 bg-[radial-gradient(135deg,#ffe066,#c8900a)] font-display text-[34px] text-[#1a1000]">
          {galleryAvatar ? (
            // biome-ignore lint/performance/noImgElement: small avatar
            // biome-ignore lint/a11y/useAltText: alt resolved by parent label
            <img
              src={galleryAvatar.src}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : identity.image ? (
            // biome-ignore lint/performance/noImgElement: small avatar
            // biome-ignore lint/a11y/useAltText: alt resolved by parent label
            <img src={identity.image} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </span>
      </span>
      {identity.isOnline && (
        <span
          aria-label={t("onlineLabel")}
          title={t("onlineLabel")}
          className="absolute bottom-1 end-1 h-3.5 w-3.5 rounded-full border-2 border-card bg-success"
        />
      )}
    </span>
  );

  return (
    <article
      aria-label={t("identityLabel", { name: identity.name })}
      className="relative overflow-hidden rounded-3xl border-2 border-border bg-card px-6 py-7 text-center [animation:popIn_0.7s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(245,200,66,0.08)_0%,transparent_70%)]"
      />

      {/* Medalla de división — esquina superior derecha. Se ancla con
          posición absoluta para no afectar al layout central (avatar
          centrado, nombre, etc) ni cuando el owner no tiene división.
          Documentación: `docs/divisions.md` §Medalla en el perfil. */}
      {division && (
        <div className="absolute end-3 top-3 z-[1]">
          <DivisionMedal division={division} />
        </div>
      )}

      <div className="relative flex flex-col items-center gap-3">
        {isOwner ? (
          <AvatarPicker
            trigger={avatarVisual}
            currentAvatarId={identity.avatarId}
            hasGoogleImage={Boolean(identity.image)}
            cooldownRemainingMs={cooldowns?.avatarCooldownRemainingMs}
          />
        ) : (
          avatarVisual
        )}

        <div className="font-display text-[26px] leading-tight text-foreground">
          {isOwner ? (
            <EditableName
              initial={identity.name}
              cooldownRemainingMs={cooldowns?.nameCooldownRemainingMs}
            />
          ) : (
            identity.name
          )}
        </div>
        <div className="-mt-1.5 text-[13px] font-extrabold tracking-wide text-muted">
          @{identity.username}
        </div>

        {identity.country && (
          <div
            aria-label={t("flagAria", { country: identity.country })}
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-border bg-card-hover px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-foreground"
          >
            <CountryFlag
              code={identity.country}
              name={identity.country}
              size={16}
              className="rounded-sm"
            />
            {identity.country}
          </div>
        )}

        <CopyLinkButton />
      </div>
    </article>
  );
}
