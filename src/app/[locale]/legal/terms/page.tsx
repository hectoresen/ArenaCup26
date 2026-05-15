import { TopChrome } from "@/components/layout/top-chrome";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

const SECTION_IDS = [
  "intro",
  "eligibility",
  "account",
  "gameplay",
  "userContent",
  "conduct",
  "intellectualProperty",
  "termination",
  "disclaimer",
  "liability",
  "changes",
  "governingLaw",
  "contact",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  return {
    title: `${t("title")} · WebMundial 26`,
    description: t("subtitle"),
  };
}

/**
 * Términos de uso públicos. Reglas del juego (link a docs/scoring),
 * comportamiento esperado, derechos de terminación de cuenta, y
 * descargo de responsabilidad típico para un MVP indie.
 */
export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  return <LegalPageContent user={session?.user ?? null} />;
}

function LegalPageContent({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  const t = useTranslations("legal.terms");
  return (
    <main
      id="main-content"
      className="relative z-10 flex min-h-screen items-start justify-center px-5 pb-16 pt-20 sm:pt-24"
    >
      <TopChrome user={user} />

      <article className="relative z-10 w-full max-w-[640px]">
        <header className="mb-8 text-center opacity-0 [animation:popIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">{t("title")}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-bold text-muted">{t("subtitle")}</p>
          <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">
            {t("lastUpdated")}
          </p>
        </header>

        <section className="space-y-6 text-[14px] leading-relaxed text-foreground">
          {SECTION_IDS.map((id) => (
            <div key={id}>
              <h2 className="mb-2 font-display text-[18px] text-gold">
                {t(`sections.${id}.heading`)}
              </h2>
              <p className="whitespace-pre-line font-bold text-foreground/90">
                {t(`sections.${id}.body`)}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-10 flex items-center justify-between gap-4 border-t-2 border-border pt-6 text-[12px] font-bold text-muted">
          <Link
            href="/legal/privacy"
            className="cursor-pointer text-gold no-underline hover:underline"
          >
            {t("seePrivacy")} →
          </Link>
          <Link href="/" className="cursor-pointer text-foreground no-underline hover:underline">
            ← {t("backHome")}
          </Link>
        </footer>
      </article>
    </main>
  );
}
