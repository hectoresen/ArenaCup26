import { isValidLocale, routing } from "@/i18n/routing";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Fredoka, Nunito } from "next/font/google";
import { notFound } from "next/navigation";
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
          Noto Color Emoji desde Google Fonts. En Windows, los emojis de
          bandera (regional indicator pairs) no rinden por defecto; este
          fallback garantiza que se vean en cualquier SO.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap"
        />
      </head>
      <body className="antialiased">
        {/* Skip link — solo visible al hacer focus con Tab. WCAG 2.4.1. */}
        <a
          href="#main-content"
          className="absolute left-2 top-2 z-50 -translate-y-32 rounded-md bg-gold px-3 py-1.5 text-[12px] font-extrabold text-[#1a1000] transition-transform focus:translate-y-0"
        >
          {dir === "rtl" ? "تخطّى إلى المحتوى" : "Saltar al contenido"}
        </a>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
