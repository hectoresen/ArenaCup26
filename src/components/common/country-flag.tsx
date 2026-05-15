type Props = {
  /** ISO 3166-1 alpha-2 ("ES", "MX", "AR", ...). Case insensitive. */
  code: string | null | undefined;
  /** Nombre del país para `alt` (accesibilidad). */
  name?: string;
  /** Ancho en px (la altura se ajusta proporcionalmente). Default 20. */
  size?: number;
  className?: string;
};

/**
 * Bandera de país como imagen SVG raster (PNG) del CDN público
 * `flagcdn.com` (Cloudflare-hosted, gratis, estable).
 *
 * Razón de no usar emoji Regional Indicator: en Windows + Chrome/
 * Edge esos códigos NO se renderizan como banderas — aparecen como
 * texto literal ("ES", "MX"…) porque el sistema no incluye los
 * pares de chars en la fuente nativa. Aunque cargamos Noto Color
 * Emoji como fallback, no siempre se aplica.
 *
 * Para mantener una sola fuente de verdad, usamos PNGs raster.
 * `flagcdn.com` requiere allowlist en CSP `img-src` (configurado
 * en `next.config.ts`).
 */
export function CountryFlag({ code, name, size = 20, className }: Props) {
  if (!code) return null;
  const trimmed = code.trim().toLowerCase();
  if (trimmed.length !== 2) return null;

  // flagcdn sirve PNG en tamaños 20/40/80/160/240/320/640 wide.
  // Pedimos el doble del tamaño visible para retina sin reflow.
  const cdnWidth = size <= 20 ? 40 : size <= 40 ? 80 : 160;
  const src = `https://flagcdn.com/w${cdnWidth}/${trimmed}.png`;
  const height = Math.round((size * 3) / 4); // aspect ratio 4:3 estándar

  return (
    // biome-ignore lint/performance/noImgElement: lazy native img is fine for flag PNGs
    // biome-ignore lint/a11y/useAltText: alt resolves to name
    <img
      src={src}
      alt={name ?? trimmed.toUpperCase()}
      width={size}
      height={height}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
