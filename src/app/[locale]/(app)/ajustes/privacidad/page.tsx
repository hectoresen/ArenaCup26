import { eq } from "drizzle-orm";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PrivacyForm } from "@/components/settings/privacy-form";
import { PushOptIn } from "@/components/push/push-opt-in";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { normalizePrivacy } from "@/server/privacy/apply";

/**
 * Página de preferencias de privacidad del usuario. SSR de los
 * valores actuales (con fallback al default público para users
 * antiguos sin la columna rellena) y un form cliente que dispara
 * la server action en cada cambio.
 */
export default async function PrivacySettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const t = await getTranslations({ locale, namespace: "privacy" });

  const row = await db
    .select({ privacy: users.privacy })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const initial = normalizePrivacy(row[0]?.privacy);

  return (
    <section className="-mx-5 -mt-5 px-5 pt-5">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-gold">{t("title")}</h1>
        <p className="mt-2 text-sm font-bold text-muted">{t("subtitle")}</p>
      </header>
      <PrivacyForm initial={initial} />
      {env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
        <div className="mt-6">
          <PushOptIn vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
        </div>
      )}

      {/* Zona peligrosa: eliminar cuenta. Link discreto al final
          para que el user lo encuentre cuando lo busque sin que
          sea lo primero que ve. */}
      <div className="mt-10 border-t-2 border-border pt-6">
        <Link
          href="/ajustes/eliminar-cuenta"
          className="cursor-pointer text-[12px] font-extrabold text-danger no-underline hover:underline"
        >
          {t("deleteAccountLink")}
        </Link>
      </div>
    </section>
  );
}
