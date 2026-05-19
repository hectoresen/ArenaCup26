import { useTranslations } from "next-intl";
import { getAvatar } from "@/server/profile/avatars";

/**
 * Iniciales para el fallback del avatar. Toma la primera letra de las
 * dos primeras palabras (no-vacías) del nombre. Si solo hay una
 * palabra, devuelve la primera letra. Limita a 2 caracteres.
 *
 * Pure function — exportada para que el componente y los tests
 * compartan la misma fuente de verdad.
 */
export function avatarInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const words = name
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0) return "?";
  const initials = words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("");
  return initials.toUpperCase() || "?";
}

type Props = {
  user: { name?: string | null; image?: string | null; avatarId?: string | null };
  size?: "sm" | "md";
};

/**
 * Avatar visual con ring conic dorado. Si el provider entrega `image`,
 * lo renderiza como `<img>` (cache del navegador, no pasa por
 * next/image). Si no, muestra iniciales en `font-display`.
 *
 * No incluye click handler ni menú — es solo presentación. El TopNav
 * lo envuelve con el `AccountMenu` existente para que el click abra
 * el dropdown.
 */
export function AppAvatar({ user, size = "md" }: Props) {
  const t = useTranslations("appShell.avatar");
  const initials = avatarInitials(user.name);
  const label = t("labelOf", { name: user.name ?? "" });
  // Si el user eligió un avatar de la galería, este gana sobre la
  // foto de Google. Mismo orden de prioridad que en ProfileHero del
  // perfil público.
  const galleryAvatar = getAvatar(user.avatarId ?? null);

  const outer = size === "sm" ? "h-8 w-8 p-[2px]" : "h-9 w-9 p-[2px]";
  const inner = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]";

  return (
    <span
      role="img"
      aria-label={label}
      className={`${outer} inline-flex flex-shrink-0 items-center justify-center rounded-full [background:conic-gradient(var(--color-gold)_0deg,var(--color-bronze)_120deg,var(--color-gold)_240deg,var(--color-gold-deep)_360deg)]`}
    >
      <span
        className={`${inner} inline-flex items-center justify-center overflow-hidden rounded-full border-2 border-black/25 bg-[radial-gradient(135deg,#ffe066,#c8900a)] font-display text-[#1a1000]`}
      >
        {galleryAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={galleryAvatar.src} alt="" className="h-full w-full object-cover" />
        ) : user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
    </span>
  );
}
