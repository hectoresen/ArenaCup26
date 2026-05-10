import { AccountMenu } from "@/components/auth/account-menu";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { JoinCta } from "@/components/leaderboard/join-cta";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/**
 * Slots fijos en las dos esquinas superiores del viewport.
 * - top-start: <LanguageSwitcher /> (siempre visible).
 * - top-end: <AccountMenu /> si hay sesión, <JoinCta /> en caso contrario.
 *
 * Usado por la home, FAQ y 404. La página de error runtime solo monta
 * el switcher porque no puede resolver `auth()` server-side.
 */
export function TopChrome({ user }: { user: SessionUser | null }) {
  return (
    <>
      <div className="fixed start-3 top-3 z-30 sm:start-5 sm:top-5">
        <LanguageSwitcher />
      </div>
      <div className="fixed end-3 top-3 z-30 sm:end-5 sm:top-5">
        {user ? <AccountMenu user={user} /> : <JoinCta />}
      </div>
    </>
  );
}
