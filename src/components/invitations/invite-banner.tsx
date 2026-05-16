"use client";

import { dismissInviteCookie } from "@/server/invitations/actions";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

type Props = {
  inviterName: string;
  inviterUsername: string | null;
};

/**
 * Banner sticky en lo alto de la página cuando hay una cookie de
 * invite activa. El SSR resuelve el inviter y monta este componente.
 *
 * Cliente solo para:
 *  - Mostrar/ocultar localmente al dismiss (sin recargar).
 *  - Llamar al server action `dismissInviteCookie`.
 *
 * El banner desaparece automáticamente tras el signup (la callback
 * `createUser` borra la cookie al redimir) — este componente no se
 * monta porque ya no hay cookie. No hay coordinación cliente↔server
 * extra: confiamos en que tras signup el siguiente request SSR ya no
 * verá la cookie.
 */
export function InviteBanner({ inviterName, inviterUsername }: Props) {
  const t = useTranslations("invite.banner");
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  function dismiss() {
    // Optimistic: ocultamos el banner antes de la action. Si falla,
    // la cookie sigue ahí pero el user ya no lo verá hasta refresh —
    // aceptable (es UX, no seguridad).
    setHidden(true);
    startTransition(() => {
      dismissInviteCookie().catch(() => {
        // Si la action falla, dejamos el banner oculto localmente
        // igualmente. El próximo render server-side podría volver a
        // mostrarlo, pero ese caso es muy improbable.
      });
    });
  }

  return (
    <aside
      role="status"
      aria-label={t("ariaLabel")}
      className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b-2 border-gold/30 bg-gradient-to-r from-gold/[0.12] via-gold/[0.08] to-gold/[0.12] px-4 py-2.5 backdrop-blur-sm"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="flex-shrink-0 text-base leading-none">
          🎟️
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-extrabold text-foreground">
            {t.rich("title", {
              name: inviterName,
              em: (chunks) => <em className="not-italic text-gold">{chunks}</em>,
            })}
          </p>
          <p className="truncate text-[10px] font-bold text-muted">{t("subtitle")}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="flex-shrink-0 cursor-pointer rounded-full p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="3" y1="3" x2="11" y2="11" />
          <line x1="11" y1="3" x2="3" y2="11" />
        </svg>
      </button>
    </aside>
  );
}
