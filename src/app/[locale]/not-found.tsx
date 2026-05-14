import { ErrorScreen } from "@/components/error/error-screen";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { FloatingBalls } from "@/components/leaderboard/floating-balls";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function NotFoundPage() {
  const t = useTranslations("errors.notFound");
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-9">
      <FloatingBalls count={5} />
      <div className="fixed start-3 top-3 z-30 sm:start-5 sm:top-5">
        <LanguageSwitcher />
      </div>
      <ErrorScreen code={t("code")} title={t("title")} description={t("description")}>
        <Link
          href="/"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-gold/40 bg-gradient-to-br from-gold to-gold-deep px-5 py-2.5 font-display text-[13px] uppercase tracking-[0.14em] text-[#1a1000] shadow-[0_0_24px_rgba(245,200,66,0.32)] transition-[transform,box-shadow] duration-200 hover:scale-[1.04] hover:shadow-[0_0_32px_rgba(245,200,66,0.55)] active:scale-[0.98]"
        >
          <span aria-hidden="true">←</span>
          {t("homeButton")}
        </Link>
      </ErrorScreen>
    </main>
  );
}
