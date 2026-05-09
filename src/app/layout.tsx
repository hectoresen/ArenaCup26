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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
