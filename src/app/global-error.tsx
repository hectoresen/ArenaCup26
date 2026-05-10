"use client";

import type { CSSProperties } from "react";

/**
 * Fallback catastrófico: solo se renderiza cuando algo rompe POR ENCIMA
 * del layout `[locale]`, donde no tenemos provider de i18n ni fuentes.
 * Inline styles, English-only, mínimo.
 */
const containerStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#0d1117",
  color: "#f0f6ff",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  padding: "2rem",
  textAlign: "center",
  margin: 0,
};

const codeStyle: CSSProperties = {
  fontSize: "5rem",
  fontWeight: 800,
  color: "#f5c842",
  lineHeight: 1,
  marginBottom: "0.5rem",
};

const titleStyle: CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 800,
  marginBottom: "0.75rem",
};

const descriptionStyle: CSSProperties = {
  maxWidth: "28rem",
  color: "rgba(240, 246, 255, 0.55)",
  marginBottom: "2rem",
};

const buttonStyle: CSSProperties = {
  padding: "0.75rem 1.5rem",
  background: "linear-gradient(135deg, #f5c842, #e8a800)",
  color: "#1a1000",
  border: "none",
  borderRadius: "9999px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  cursor: "pointer",
  fontSize: "0.85rem",
};

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={containerStyle}>
        <div style={codeStyle}>!</div>
        <h1 style={titleStyle}>Something went wrong</h1>
        <p style={descriptionStyle}>
          A critical error occurred and the application could not recover. Please reload
          the page.
        </p>
        <button type="button" style={buttonStyle} onClick={reset}>
          Reload
        </button>
      </body>
    </html>
  );
}
