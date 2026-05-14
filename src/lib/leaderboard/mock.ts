import type { LeaderboardSnapshot, Player } from "./types";

type Seed = Omit<Player, "rank" | "previousRank">;

const seed: Seed[] = [
  {
    id: "u1",
    name: "Carlos Mendoza",
    countryCode: "MX",
    countryName: "México",
    flag: "🇲🇽",
    points: 4820,
    streak: 7,
    correctCount: 34,
  },
  {
    id: "u2",
    name: "Layla Hassan",
    countryCode: "SA",
    countryName: "Arabia Saudí",
    flag: "🇸🇦",
    points: 4610,
    streak: 5,
    correctCount: 31,
  },
  {
    id: "u3",
    name: "Tomás Reyes",
    countryCode: "AR",
    countryName: "Argentina",
    flag: "🇦🇷",
    points: 4390,
    streak: 4,
    correctCount: 29,
  },
  {
    id: "u4",
    name: "Yuki Tanaka",
    countryCode: "JP",
    countryName: "Japón",
    flag: "🇯🇵",
    points: 3970,
    streak: 3,
    correctCount: 26,
  },
  {
    id: "u5",
    name: "Amara Diallo",
    countryCode: "SN",
    countryName: "Senegal",
    flag: "🇸🇳",
    points: 3740,
    streak: 2,
    correctCount: 24,
  },
  {
    id: "u6",
    name: "Erik Holmberg",
    countryCode: "SE",
    countryName: "Suecia",
    flag: "🇸🇪",
    points: 3510,
    streak: 6,
    correctCount: 22,
  },
  {
    id: "u7",
    name: "Priya Sharma",
    countryCode: "IN",
    countryName: "India",
    flag: "🇮🇳",
    points: 3280,
    streak: 1,
    correctCount: 20,
  },
  {
    id: "u8",
    name: "Mateus Costa",
    countryCode: "BR",
    countryName: "Brasil",
    flag: "🇧🇷",
    points: 3050,
    streak: 4,
    correctCount: 18,
  },
  {
    id: "u9",
    name: "Zara Al-Farsi",
    countryCode: "OM",
    countryName: "Omán",
    flag: "🇴🇲",
    points: 2820,
    streak: 2,
    correctCount: 16,
  },
  {
    id: "u10",
    name: "Jonas Becker",
    countryCode: "DE",
    countryName: "Alemania",
    flag: "🇩🇪",
    points: 2640,
    streak: 0,
    correctCount: 14,
  },
];

/**
 * Provider de datos del leaderboard.
 *
 * Por ahora retorna un snapshot mock construido a partir de `seed`.
 * Cuando llegue `add-leaderboard-sse` y `add-match-data-providers`,
 * esta función se reemplazará por una query real (BD + cache);
 * los componentes no requieren cambios.
 */
export async function getInitialSnapshot(): Promise<LeaderboardSnapshot> {
  const sorted = [...seed].sort((a, b) => b.points - a.points);
  const players: Player[] = sorted.map((p, i) => ({
    ...p,
    rank: i + 1,
    previousRank: i + 1,
  }));
  return {
    generatedAt: new Date().toISOString(),
    players,
  };
}
