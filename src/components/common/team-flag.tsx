type Props = {
  /**
   * Valor del campo `flag` del team:
   *   - Emoji bandera (`"🇪🇸"`) → render como texto.
   *   - URL absoluta (`"https://media.api-sports.io/..."`) → render como `<img>`.
   *   - `null` → fallback configurable.
   */
  flag: string | null | undefined;
  /** Nombre del equipo para `aria-label`. */
  name: string;
  /** Tamaño en px del lado del cuadrado (aplica al `<img>`). */
  size?: number;
  /**
   * Clases del wrapper. Para `<img>` se aplica `width/height` desde `size`.
   * Para emojis se inyecta `text-[${size}px]` aproximado.
   */
  className?: string;
  /** Fallback cuando flag es null. Default 🏳️. */
  fallback?: string;
};

/**
 * Renderiza la bandera/logo de un equipo. Cubre dos modelos de datos:
 *
 *  - Equipos seedados a mano (WC 2022) tienen `flag` como emoji 🇦🇷.
 *  - Equipos derivados de api-football tienen `flag` como URL del logo
 *    (`https://media.api-sports.io/football/teams/<id>.png`).
 *
 * Sin este wrapper, los componentes que hacen `{team.flag ?? "🏳️"}`
 * imprimen la URL como texto plano cuando viene del provider. Esto
 * unifica el render sin migrar el dato.
 */
export function TeamFlag({ flag, name, size = 24, className, fallback = "🏳️" }: Props) {
  if (flag && /^https?:\/\//.test(flag)) {
    // Logos de api-football son ~64x64 PNG. Usamos <img> en lugar de
    // next/image para no requerir `remotePatterns` config ni consumir
    // optimization quota — son cientos por página y son pequeños.
    return (
      // biome-ignore lint/performance/noImgElement: see comment above
      // biome-ignore lint/a11y/useAltText: alt resolves to name
      <img
        src={flag}
        alt={name}
        width={size}
        height={size}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span role="img" aria-label={name} className={className}>
      {flag ?? fallback}
    </span>
  );
}
