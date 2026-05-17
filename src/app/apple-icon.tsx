import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

/**
 * Apple touch icon — el icono que iOS usa cuando alguien añade la
 * web al Home Screen. Apple no acepta SVG, así que renderizamos
 * dinámicamente un PNG con `ImageResponse`. Mismo lenguaje visual
 * que `app/icon.svg`: copa dorada sobre fondo dark, sin esquinas
 * redondeadas (iOS las añade encima).
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #1a2030 0%, #0d1117 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 120, lineHeight: 1 }}>🏆</span>
      </div>
    ),
    { ...size },
  );
}
