import { CountryFlag } from "./country-flag";
import { flagEmojiToCountryCode } from "@/lib/format/country";

type Props = {
  /**
   * Valor del campo `flag` del team:
   *   - URL absoluta (`"https://media.api-sports.io/..."`) → `<img>`.
   *   - Emoji ISO de bandera (`"🇦🇷"`) → `<CountryFlag>` PNG (no
   *     se renderiza como texto porque en Windows no se ve).
   *   - Otra cosa (subdivision flag, texto, null) → fallback configurable.
   */
  flag: string | null | undefined;
  /** Nombre del equipo para `aria-label`. */
  name: string;
  /** Tamaño en px del lado del cuadrado. */
  size?: number;
  className?: string;
  /** Fallback cuando flag es null o no se puede renderizar. Default 🏳️. */
  fallback?: string;
};

/**
 * Renderiza la bandera/logo de un equipo. Tres modos:
 *
 *  - Equipos derivados de api-football tienen `flag` como URL del
 *    logo (`https://media.api-sports.io/football/teams/<id>.png`)
 *    → render como `<img>`.
 *  - Equipos seedados a mano (WC 2022) tienen `flag` como emoji
 *    `"🇦🇷"`. En lugar de renderizarlo como texto (que en Windows +
 *    Chrome aparece como "AR"), extraemos el code ISO y delegamos
 *    a `<CountryFlag>` que sirve PNG vía flagcdn.com.
 *  - Banderas subdivision (Inglaterra 🏴) o texto raro → fallback.
 */
export function TeamFlag({ flag, name, size = 24, className, fallback = "🏳️" }: Props) {
  // 1) URL → <img> del logo del provider.
  if (flag && /^https?:\/\//.test(flag)) {
    return (
      // biome-ignore lint/performance/noImgElement: small PNG flags, no Next/Image needed
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

  // 2) Emoji ISO → traducir a code y usar PNG real.
  const code = flagEmojiToCountryCode(flag);
  if (code) {
    return <CountryFlag code={code} name={name} size={size} className={className} />;
  }

  // 3) Cualquier otra cosa: render como texto (subdivisional flags,
  //    fallback emoji, codes 3-letras, etc.).
  return (
    <span role="img" aria-label={name} className={className}>
      {flag ?? fallback}
    </span>
  );
}
