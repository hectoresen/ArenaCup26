import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { PrivacyForm } from "@/components/settings/privacy-form";
import { PushOptIn } from "@/components/push/push-opt-in";
import type { UserPrivacy } from "@/server/privacy/apply";
import { useTranslations } from "next-intl";

type Props = {
  initialPrivacy: UserPrivacy;
  /** VAPID public key. Si está vacía, el bloque push no se monta. */
  vapidPublicKey: string | null;
};

/**
 * "Ajustes de mi cuenta" — acordeón owner-only en `/u/<username>`
 * que consolida en un único sitio:
 *  - Visibilidad del perfil (PrivacyForm)
 *  - Notificaciones push (PushOptIn, condicional a VAPID set)
 *  - Eliminar mi cuenta (DeleteAccountForm con doble confirmación)
 *
 * Anterior diseño tenía `/ajustes/privacidad` y `/ajustes/eliminar-cuenta`
 * como rutas separadas; ahora todo vive aquí porque el "perfil" es ya
 * el centro de control del usuario. Acordeón cerrado por defecto: los
 * ajustes son tarea ocasional, no la prioridad visual.
 */
export function AccountSettingsAccordion({ initialPrivacy, vapidPublicKey }: Props) {
  const t = useTranslations("accountSettings");

  return (
    <details
      id="ajustes"
      className="mt-4 group rounded-2xl border-2 border-border bg-card open:border-gold/30"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 transition-colors hover:bg-card-hover">
        <div>
          <div className="font-display text-[14px] uppercase tracking-[0.1em] text-gold">
            ⚙️ {t("title")}
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-muted">{t("subtitle")}</div>
        </div>
        <span
          aria-hidden="true"
          className="font-display text-base text-muted transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>

      <div className="space-y-8 border-t border-border px-4 py-5">
        {/* Privacidad */}
        <section>
          <header className="mb-3">
            <h3 className="font-display text-[13px] uppercase tracking-[0.1em] text-gold">
              {t("privacyTitle")}
            </h3>
            <p className="mt-1 text-[12px] font-bold text-muted">{t("privacySubtitle")}</p>
          </header>
          <PrivacyForm initial={initialPrivacy} />
        </section>

        {/* Push notifications (solo si VAPID está set en server) */}
        {vapidPublicKey && (
          <section>
            <header className="mb-3">
              <h3 className="font-display text-[13px] uppercase tracking-[0.1em] text-gold">
                {t("pushTitle")}
              </h3>
            </header>
            <PushOptIn vapidPublicKey={vapidPublicKey} />
          </section>
        )}

        {/* Zona peligrosa: eliminar cuenta */}
        <section className="border-t-2 border-danger/15 pt-6">
          <header className="mb-3">
            <h3 className="font-display text-[13px] uppercase tracking-[0.1em] text-danger">
              {t("dangerTitle")}
            </h3>
            <p className="mt-1 text-[12px] font-bold text-muted">{t("dangerSubtitle")}</p>
          </header>
          <DeleteAccountForm />
        </section>
      </div>
    </details>
  );
}
