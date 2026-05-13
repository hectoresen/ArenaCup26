import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

export default async function LogrosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ComingSoon />;
}

function ComingSoon() {
  const t = useTranslations("comingSoon");
  return (
    <section className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <span aria-hidden="true" className="text-5xl">
        🏆
      </span>
      <h1 className="font-display text-2xl text-gold">{t("title.achievements")}</h1>
      <p className="max-w-xs text-sm font-bold text-muted">{t("body.achievements")}</p>
      <Link
        href="/inicio"
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-gold/30 bg-card px-4 py-1.5 text-xs font-extrabold text-gold transition-colors hover:border-gold hover:bg-card-hover"
      >
        ← {t("backToHome")}
      </Link>
    </section>
  );
}
