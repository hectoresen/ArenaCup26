/**
 * 32 selecciones que disputaron la Copa del Mundo Qatar 2022.
 * Códigos FIFA de 3 letras (estándar internacional).
 */
export type WC2022TeamSeed = {
  code: string;
  name: string;
  flag: string;
  group: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
};

export const WC2022_TEAMS: WC2022TeamSeed[] = [
  // Group A
  { code: "QAT", name: "Qatar", flag: "🇶🇦", group: "A" },
  { code: "ECU", name: "Ecuador", flag: "🇪🇨", group: "A" },
  { code: "SEN", name: "Senegal", flag: "🇸🇳", group: "A" },
  { code: "NED", name: "Netherlands", flag: "🇳🇱", group: "A" },
  // Group B
  { code: "ENG", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "B" },
  { code: "IRN", name: "Iran", flag: "🇮🇷", group: "B" },
  { code: "USA", name: "United States", flag: "🇺🇸", group: "B" },
  { code: "WAL", name: "Wales", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", group: "B" },
  // Group C
  { code: "ARG", name: "Argentina", flag: "🇦🇷", group: "C" },
  { code: "KSA", name: "Saudi Arabia", flag: "🇸🇦", group: "C" },
  { code: "MEX", name: "Mexico", flag: "🇲🇽", group: "C" },
  { code: "POL", name: "Poland", flag: "🇵🇱", group: "C" },
  // Group D
  { code: "FRA", name: "France", flag: "🇫🇷", group: "D" },
  { code: "AUS", name: "Australia", flag: "🇦🇺", group: "D" },
  { code: "DEN", name: "Denmark", flag: "🇩🇰", group: "D" },
  { code: "TUN", name: "Tunisia", flag: "🇹🇳", group: "D" },
  // Group E
  { code: "ESP", name: "Spain", flag: "🇪🇸", group: "E" },
  { code: "CRC", name: "Costa Rica", flag: "🇨🇷", group: "E" },
  { code: "GER", name: "Germany", flag: "🇩🇪", group: "E" },
  { code: "JPN", name: "Japan", flag: "🇯🇵", group: "E" },
  // Group F
  { code: "BEL", name: "Belgium", flag: "🇧🇪", group: "F" },
  { code: "CAN", name: "Canada", flag: "🇨🇦", group: "F" },
  { code: "MAR", name: "Morocco", flag: "🇲🇦", group: "F" },
  { code: "CRO", name: "Croatia", flag: "🇭🇷", group: "F" },
  // Group G
  { code: "BRA", name: "Brazil", flag: "🇧🇷", group: "G" },
  { code: "SRB", name: "Serbia", flag: "🇷🇸", group: "G" },
  { code: "CHE", name: "Switzerland", flag: "🇨🇭", group: "G" },
  { code: "CMR", name: "Cameroon", flag: "🇨🇲", group: "G" },
  // Group H
  { code: "POR", name: "Portugal", flag: "🇵🇹", group: "H" },
  { code: "GHA", name: "Ghana", flag: "🇬🇭", group: "H" },
  { code: "URU", name: "Uruguay", flag: "🇺🇾", group: "H" },
  { code: "KOR", name: "South Korea", flag: "🇰🇷", group: "H" },
];
