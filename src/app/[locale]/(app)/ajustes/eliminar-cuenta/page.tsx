import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Página de eliminación de cuenta. Acceso protegido (sin sesión →
 * redirect a `/`). Renderiza un formulario con doble confirmación y
 * una explicación clara de qué se borra.
 *
 * RGPD: art. 17 (derecho al borrado). La acción cascadea los datos
 * por las FK ON DELETE CASCADE, así que un único DELETE FROM users
 * elimina todo. El plazo de 30 días en la privacy policy aplica
 * solo a peticiones por email — el self-service es inmediato.
 */
export default async function EliminarCuentaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  return <Content />;
}

function Content() {
  const t = useTranslations("settings.deleteAccount");
  return (
    <section className="-mx-5 -mt-5 px-5 pt-5">
      <header className="mb-5">
        <Link
          href="/ajustes/privacidad"
          className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-extrabold text-gold no-underline transition-[gap] hover:gap-2.5"
        >
          <span aria-hidden="true">←</span> {t("backToSettings")}
        </Link>
        <h1 className="font-display text-3xl text-danger">{t("title")}</h1>
        <p className="mt-2 text-sm font-bold text-muted">{t("subtitle")}</p>
      </header>

      <DeleteAccountForm />
    </section>
  );
}
