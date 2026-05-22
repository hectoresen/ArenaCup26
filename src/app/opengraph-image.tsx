import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export const alt = "ArenaCup26 — Predice los partidos del Mundial 2026";

/**
 * Open Graph image que se muestra cuando se comparte la URL en
 * WhatsApp, Twitter, Telegram, Discord, etc. 1200×630 es el ratio
 * estándar de OG/Twitter Cards. Renderizado dinámico vía
 * `ImageResponse` — sin necesidad de generar PNG manualmente.
 *
 * Mismo lenguaje visual que el resto de la app: fondo dark con
 * acento gold, copa central, tipografía bold + claim secundario.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "radial-gradient(ellipse at 50% 30%, #1a2030 0%, #0d1117 65%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 80px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
      }}
    >
      {/* Top accent strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "linear-gradient(90deg, transparent 0%, #f5c842 50%, transparent 100%)",
        }}
      />

      <div style={{ fontSize: 220, lineHeight: 1, marginBottom: 20 }}>🏆</div>

      <div
        style={{
          fontSize: 96,
          fontWeight: 900,
          color: "#f5c842",
          letterSpacing: -2,
          marginBottom: 14,
          textShadow: "0 4px 24px rgba(245,200,66,0.35)",
          display: "flex",
        }}
      >
        ArenaCup26
      </div>

      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: "#e8e8e8",
          textAlign: "center",
          letterSpacing: 0.5,
          display: "flex",
        }}
      >
        Predice el Mundial 2026 · Compite con tus amigos
      </div>

      {/* Bottom URL chip */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          fontSize: 26,
          fontWeight: 800,
          color: "#a8a8a8",
          letterSpacing: 1.5,
          display: "flex",
        }}
      >
        www.arenacup26.com
      </div>
    </div>,
    { ...size },
  );
}
