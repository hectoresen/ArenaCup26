"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/error/error-screen";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { FloatingBalls } from "@/components/leaderboard/floating-balls";
import { Link } from "@/i18n/navigation";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.runtime");

  useEffect(() => {
    console.error("[wmundial] runtime error", error);
  }, [error]);

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-9">
      <FloatingBalls count={5} />
      <div className="fixed start-3 top-3 z-30 sm:start-5 sm:top-5">
        <LanguageSwitcher />
      </div>
      <ErrorScreen code={t("code")} title={t("title")} description={t("description")}>
        <button
          type="button"
          onClick={reset}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-gold/40 bg-gradient-to-br from-gold to-gold-deep px-5 py-2.5 font-display text-[13px] uppercase tracking-[0.14em] text-[#1a1000] shadow-[0_0_24px_rgba(245,200,66,0.32)] transition-[transform,box-shadow] duration-200 hover:scale-[1.04] hover:shadow-[0_0_32px_rgba(245,200,66,0.55)] active:scale-[0.98]"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 8 a6 6 0 1 1 -1.5 -4 M14 3 V8 H9" />
          </svg>
          {t("retryButton")}
        </button>
        <Link
          href="/"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-border bg-card px-5 py-2.5 font-display text-[13px] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-gold/30 hover:bg-card-hover"
        >
          <span aria-hidden="true">←</span>
          {t("homeButton")}
        </Link>
      </ErrorScreen>
    </main>
  );
}
