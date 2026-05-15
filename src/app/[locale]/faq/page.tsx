import { FaqItem } from "@/components/faq/faq-item";
import { ScoringTable } from "@/components/faq/scoring-table";
import { TopChrome } from "@/components/layout/top-chrome";
import { FloatingBalls } from "@/components/leaderboard/floating-balls";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

const QUESTION_IDS = [
  "doublePrediction",
  "predictionWindow",
  "postponedCancelled",
  "knockoutScoring",
  "provisional",
  "streakAndCombo",
  "achievements",
  "username",
  "deleteAccount",
] as const;

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  return <FaqPageContent user={session?.user ?? null} />;
}

function FaqPageContent({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  const t = useTranslations("faq");
  return (
    <main
      id="main-content"
      className="relative z-10 flex min-h-screen items-start justify-center px-5 pb-16 pt-20 sm:pt-24"
    >
      <FloatingBalls count={5} />
      <TopChrome user={user} />

      <article className="relative z-10 w-full max-w-[560px]">
        <header className="mb-8 text-center opacity-0 [animation:popIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">{t("title")}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-bold text-muted">{t("subtitle")}</p>
        </header>

        <ScoringTable />

        <section className="mt-10" aria-labelledby="faq-questions-title">
          <h2 id="faq-questions-title" className="mb-1 font-display text-xl text-gold sm:text-2xl">
            {t("questions.title")}
          </h2>
          <p className="mb-4 text-sm font-bold text-muted">{t("questions.subtitle")}</p>

          <div className="flex flex-col gap-2">
            {QUESTION_IDS.map((id) => (
              <FaqItem key={id} question={t(`questions.items.${id}.q`)}>
                {t(`questions.items.${id}.a`)}
              </FaqItem>
            ))}
          </div>
        </section>

        <div className="mt-10 flex justify-center">
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-gold/40 bg-gradient-to-br from-gold to-gold-deep px-5 py-2.5 font-display text-[13px] uppercase tracking-[0.14em] text-[#1a1000] shadow-[0_0_24px_rgba(245,200,66,0.32)] transition-[transform,box-shadow] duration-200 hover:scale-[1.04] hover:shadow-[0_0_32px_rgba(245,200,66,0.55)] active:scale-[0.98]"
          >
            <span aria-hidden="true">←</span>
            {t("backButton")}
          </Link>
        </div>
      </article>
    </main>
  );
}
