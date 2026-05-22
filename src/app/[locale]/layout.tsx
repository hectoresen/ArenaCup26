import { MaintenanceBanner } from "@/components/admin/maintenance-banner";
import { AppFooter } from "@/components/common/app-footer";
import { InviteBannerMount } from "@/components/invitations/invite-banner-mount";
import { isValidLocale, routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Fredoka, Nunito } from "next/font/google";
import { notFound } from "next/navigation";
import Script from "next/script";
import "../globals.css";

/**
 * Viewport + themeColor compartido para toda la app. Importante:
 *  - `viewportFit: 'cover'` para que el contenido pueda dibujarse
 *    bajo la notch del iPhone; el padding `env(safe-area-inset-*)`
 *    en globals.css mantiene el contenido legible.
 *  - `themeColor` coincide con `--color-background` para una barra
 *    de estado integrada en iOS/Android.
 *  - `maximumScale=5` mejor que 1 — no bloquear el zoom (a11y).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0d1117",
};

// "Fredoka One" se discontinuó en Google Fonts y se fusionó con la variable
// "Fredoka". El peso 600 reproduce el look del antiguo "Fredoka One".
const fredokaOne = Fredoka({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-fredoka-one",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: t("title"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${fredokaOne.variable} ${nunito.variable}`}>
      <head>
        {/*
          Antes cargábamos Noto Color Emoji desde Google Fonts para
          renderizar banderas en Windows (regional indicator pairs no
          rinden por defecto). Ahora las banderas usan `<CountryFlag>`
          con PNGs de flagcdn.com — la fuente externa ya no aporta y
          forzaba relajar la CSP. Los emojis residuales (🌍, 📊…) son
          codepoints estándar que rinden con la fuente nativa del SO
          (Apple Color Emoji, Segoe UI Emoji, etc.).
        */}
        {/*
          Plausible analytics (privacy-friendly, sin cookies, sin PII).
          Solo se inyecta si NEXT_PUBLIC_PLAUSIBLE_DOMAIN está set —
          en dev local queda en noop. No requiere banner de consent
          bajo RGPD/ePrivacy porque no almacena identificadores en
          el navegador.
        */}
        {env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            strategy="afterInteractive"
            defer
            data-domain={env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src={env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL}
          />
        )}
      </head>
      <body className="antialiased">
        {/* Skip link — solo visible al hacer focus con Tab. WCAG 2.4.1. */}
        <a
          href="#main-content"
          className="absolute left-2 top-2 z-50 -translate-y-32 rounded-md bg-gold px-3 py-1.5 text-[12px] font-extrabold text-[#1a1000] transition-transform focus:translate-y-0"
        >
          {dir === "rtl" ? "تخطّى إلى المحتوى" : "Saltar al contenido"}
        </a>
        <NextIntlClientProvider messages={messages}>
          {/* Banner global cuando el admin ha activado modo mantenimiento.
              SSR-only, sin botón de cerrar — debe seguir visible hasta
              que el admin lo desactive. */}
          <MaintenanceBanner />
          {/* Banner sticky cuando hay cookie de invite activa y el
              visitante NO está logado. SSR-only — el server resuelve
              el inviter; si no aplica, no se monta nada. */}
          <InviteBannerMount />
          {children}
          <AppFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
