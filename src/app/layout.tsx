import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "WebMundial 26 · Ranking",
  description:
    "Plataforma social y competitiva alrededor del Mundial de Fútbol 2026. Predice partidos, sube en el ranking, desbloquea logros.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${fredokaOne.variable} ${nunito.variable}`}>
      <head>
        {/*
          Noto Color Emoji desde Google Fonts. En Windows, los emojis de
          bandera (regional indicator pairs) no rinden por defecto; este
          fallback garantiza que se vean en cualquier SO. Se cachea de forma
          agresiva tras la primera carga.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
