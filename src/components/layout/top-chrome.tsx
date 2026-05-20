import { AccountMenu } from "@/components/auth/account-menu";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { JoinCta } from "@/components/leaderboard/join-cta";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  username?: string | null;
};

/**
 * Slots fijos del viewport para la cabecera flotante:
 *
 *  - **top-start**: `<LanguageSwitcher />` (siempre arriba a la izquierda).
 *  - **top-end (logado)**: `<AccountMenu />` arriba a la derecha.
 *  - **CTA de registro (no logado)**:
 *      - **mobile**: barra inferior centrada (sticky). El botón
 *        "Predecir ahora" se solapaba con el trofeo/héroe de la
 *        landing — moverlo abajo respeta el contenido principal y
 *        encima queda al alcance del pulgar.
 *      - **desktop (≥ sm)**: vuelve arriba a la derecha como siempre.
 *
 * Usado por la home, FAQ, legal y perfiles públicos. La página de
 * error runtime solo monta el switcher porque no puede resolver
 * `auth()` server-side.
 */
export function TopChrome({ user }: { user: SessionUser | null }) {
  return (
    <>
      <div className="fixed start-3 top-3 z-30 sm:start-5 sm:top-5">
        <LanguageSwitcher />
      </div>
      {user ? (
        <div className="fixed end-3 top-3 z-30 sm:end-5 sm:top-5">
          <AccountMenu user={user} />
        </div>
      ) : (
        // En mobile va abajo centrado, respeta safe-area del iPhone.
        // En desktop pasa a esquina top-end como antes (mismas
        // coordenadas y tamaño que antes — el botón se reescala via
        // sus propias clases `sm:`).
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-auto sm:end-5 sm:top-5 sm:justify-end sm:px-0 sm:pb-0">
          <JoinCta />
        </div>
      )}
    </>
  );
}
