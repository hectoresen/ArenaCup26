import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { PrivacyForm } from "@/components/settings/privacy-form";
import { PushOptIn } from "@/components/push/push-opt-in";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { normalizePrivacy } from "@/server/privacy/apply";
import { eq } from "drizzle-orm";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Página `/ajustes` — centro de control del user logado: privacidad,
 * notificaciones push y zona peligrosa (eliminar cuenta).
 *
 * Antes vivía como acordeón en `/u/<username>` (owner-only). Movido
 * a esta ruta dedicada el 2026-05-18 para que sea accesible desde el
 * dropdown de la cabecera sin tener que pasar por el perfil público.
 */
export default async function AjustesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const row = await db
    .select({ privacy: users.privacy })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const privacy = normalizePrivacy(row[0]?.privacy);

  return (
    <AjustesLayout
      initialPrivacy={privacy}
      vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
    />
  );
}

function AjustesLayout({
  initialPrivacy,
  vapidPublicKey,
}: {
  initialPrivacy: ReturnType<typeof normalizePrivacy>;
  vapidPublicKey: string | null;
}) {
  const t = useTranslations("accountSettings");
  return (
    <>
      <header className="mb-6">
        <h1 className="mb-1 font-display text-[26px] leading-none text-foreground">
          {t("title")}
        </h1>
        <p className="text-[13px] font-bold text-muted">{t("subtitle")}</p>
      </header>

      {/* Privacidad */}
      <section className="mb-8 rounded-2xl border-2 border-border bg-card p-5">
        <header className="mb-4">
          <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-gold">
            {t("privacyTitle")}
          </h2>
          <p className="mt-1 text-[12px] font-bold text-muted">{t("privacySubtitle")}</p>
        </header>
        <PrivacyForm initial={initialPrivacy} />
      </section>

      {/* Push notifications (solo si VAPID está set en server) */}
      {vapidPublicKey && (
        <section className="mb-8 rounded-2xl border-2 border-border bg-card p-5">
          <header className="mb-4">
            <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-gold">
              {t("pushTitle")}
            </h2>
          </header>
          <PushOptIn vapidPublicKey={vapidPublicKey} />
        </section>
      )}

      {/* Zona peligrosa: eliminar cuenta */}
      <section className="rounded-2xl border-2 border-danger/20 bg-card p-5">
        <header className="mb-4">
          <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-danger">
            {t("dangerTitle")}
          </h2>
          <p className="mt-1 text-[12px] font-bold text-muted">{t("dangerSubtitle")}</p>
        </header>
        <DeleteAccountForm />
      </section>
    </>
  );
}
