/**
 * Lista corta de países curada para el selector de onboarding.
 * Cubre las 32 selecciones del Mundial 2026 + países con
 * comunidades hispanohablantes destacadas para early users. Si un
 * usuario es de un país no listado, el form acepta cualquier código
 * ISO 3166-1 alpha-2 escrito a mano (input libre como fallback).
 */
export type CountryOption = {
  code: string;
  name: string;
};

export const COUNTRIES: CountryOption[] = [
  // Hispano
  { code: "ES", name: "España" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "México" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Perú" },
  { code: "CL", name: "Chile" },
  { code: "VE", name: "Venezuela" },
  { code: "EC", name: "Ecuador" },
  { code: "UY", name: "Uruguay" },
  { code: "PY", name: "Paraguay" },
  { code: "BO", name: "Bolivia" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panamá" },
  { code: "DO", name: "República Dominicana" },
  { code: "CU", name: "Cuba" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "SV", name: "El Salvador" },
  { code: "NI", name: "Nicaragua" },
  { code: "PR", name: "Puerto Rico" },
  // Resto Mundial 26 destacados
  { code: "BR", name: "Brasil" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "IT", name: "Italia" },
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "Reino Unido" },
  { code: "NL", name: "Países Bajos" },
  { code: "BE", name: "Bélgica" },
  { code: "US", name: "Estados Unidos" },
  { code: "CA", name: "Canadá" },
  { code: "JP", name: "Japón" },
  { code: "KR", name: "Corea del Sur" },
  { code: "SA", name: "Arabia Saudí" },
  { code: "MA", name: "Marruecos" },
  { code: "EG", name: "Egipto" },
  { code: "SN", name: "Senegal" },
  { code: "AU", name: "Australia" },
  { code: "DK", name: "Dinamarca" },
  { code: "SE", name: "Suecia" },
  { code: "NO", name: "Noruega" },
  { code: "FI", name: "Finlandia" },
  { code: "PL", name: "Polonia" },
  { code: "CH", name: "Suiza" },
  { code: "AT", name: "Austria" },
  { code: "TR", name: "Turquía" },
  { code: "IL", name: "Israel" },
  { code: "QA", name: "Qatar" },
  { code: "AE", name: "Emiratos Árabes Unidos" },
  { code: "ZA", name: "Sudáfrica" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "CI", name: "Costa de Marfil" },
  { code: "TN", name: "Túnez" },
  { code: "IR", name: "Irán" },
];

/** True si el code está en la lista corta. */
export function isKnownCountry(code: string): boolean {
  const up = code.toUpperCase();
  return COUNTRIES.some((c) => c.code === up);
}
