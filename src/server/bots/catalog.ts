/**
 * Catálogo canónico de bots (`add-bot-users`, 2026-05-19).
 *
 * 27 entries — usuarios sintéticos que pueblan el ranking durante
 * el cold-start del Mundial 2026. Cada uno predice toda la fase de
 * grupos al activarse y luego queda "muerto" (no predice eliminatorias).
 *
 * - **Username**: kebab-case único. PK lógica del catálogo.
 * - **ID**: UUID determinístico para que el seed sea idempotente y
 *   los referees externos (logs, links) sean estables entre deploys.
 * - **Country**: ISO-2 (mayúsculas). Diversidad global con énfasis
 *   Latam + Europa (audience principal del producto).
 * - **AvatarId**: uno de `champion | duel | podium | oracle` (los
 *   4 SVG de `/public/avatars`). Distribución ~6-7 bots por avatar.
 * - **Style**: cómo predice — ver `predict.ts`.
 *   - `simple` (19 bots, ~70%): solo 1X2 uniforme.
 *   - `mixed` (5 bots, ~20%): 80% simple + 20% exacto plausible.
 *   - `daredevil` (3 bots, ~10%): 30% simple + 70% exacto extremo.
 * - **CreatedAtOffsetDays**: días en el pasado para escalonar el
 *   `created_at` en BD (5-38d). Sin esto los 27 bots aparecerían
 *   creados al mismo segundo, raro en `/u/<username>`.
 *
 * IMPORTANTE: NO se expone este catálogo en API pública. Solo
 * scripts internos y queries server-side.
 */

export type BotStyle = "simple" | "mixed" | "daredevil";
export type BotAvatar = "champion" | "duel" | "podium" | "oracle";

export type BotDefinition = {
  id: string;
  username: string;
  name: string;
  country: string; // ISO-2 mayúsculas
  avatarId: BotAvatar;
  style: BotStyle;
  createdAtOffsetDays: number;
};

export const BOT_CATALOG: readonly BotDefinition[] = [
  // ───── Latinoamérica (8) ─────
  {
    id: "00000000-0000-4000-b000-000000000001",
    username: "diego-martinez",
    name: "Diego Martínez",
    country: "AR",
    avatarId: "champion",
    style: "daredevil",
    createdAtOffsetDays: 32,
  },
  {
    id: "00000000-0000-4000-b000-000000000002",
    username: "sofia-ramirez",
    name: "Sofía Ramírez",
    country: "MX",
    avatarId: "oracle",
    style: "simple",
    createdAtOffsetDays: 28,
  },
  {
    id: "00000000-0000-4000-b000-000000000003",
    username: "lucas-silva",
    name: "Lucas Silva",
    country: "BR",
    avatarId: "duel",
    style: "simple",
    createdAtOffsetDays: 25,
  },
  {
    id: "00000000-0000-4000-b000-000000000004",
    username: "camila-torres",
    name: "Camila Torres",
    country: "CO",
    avatarId: "podium",
    style: "mixed",
    createdAtOffsetDays: 23,
  },
  {
    id: "00000000-0000-4000-b000-000000000005",
    username: "mateo-rojas",
    name: "Mateo Rojas",
    country: "PE",
    avatarId: "champion",
    style: "simple",
    createdAtOffsetDays: 20,
  },
  {
    id: "00000000-0000-4000-b000-000000000006",
    username: "valentina-cruz",
    name: "Valentina Cruz",
    country: "CL",
    avatarId: "duel",
    style: "simple",
    createdAtOffsetDays: 18,
  },
  {
    id: "00000000-0000-4000-b000-000000000007",
    username: "joaquin-vega",
    name: "Joaquín Vega",
    country: "UY",
    avatarId: "podium",
    style: "simple",
    createdAtOffsetDays: 15,
  },
  {
    id: "00000000-0000-4000-b000-000000000008",
    username: "renata-alvarez",
    name: "Renata Álvarez",
    country: "VE",
    avatarId: "oracle",
    style: "mixed",
    createdAtOffsetDays: 13,
  },

  // ───── Europa (7) ─────
  {
    id: "00000000-0000-4000-b000-000000000009",
    username: "mireia-castell",
    name: "Mireia Castell",
    country: "ES",
    avatarId: "champion",
    style: "simple",
    createdAtOffsetDays: 38,
  },
  {
    id: "00000000-0000-4000-b000-000000000010",
    username: "hugo-lefevre",
    name: "Hugo Lefèvre",
    country: "FR",
    avatarId: "duel",
    style: "simple",
    createdAtOffsetDays: 35,
  },
  {
    id: "00000000-0000-4000-b000-000000000011",
    username: "felix-hartmann",
    name: "Felix Hartmann",
    country: "DE",
    avatarId: "podium",
    style: "simple",
    createdAtOffsetDays: 31,
  },
  {
    id: "00000000-0000-4000-b000-000000000012",
    username: "olivia-bennett",
    name: "Olivia Bennett",
    country: "GB",
    avatarId: "oracle",
    style: "daredevil",
    createdAtOffsetDays: 27,
  },
  {
    id: "00000000-0000-4000-b000-000000000013",
    username: "alessandra-conti",
    name: "Alessandra Conti",
    country: "IT",
    avatarId: "champion",
    style: "mixed",
    createdAtOffsetDays: 24,
  },
  {
    id: "00000000-0000-4000-b000-000000000014",
    username: "tiago-almeida",
    name: "Tiago Almeida",
    country: "PT",
    avatarId: "duel",
    style: "simple",
    createdAtOffsetDays: 21,
  },
  {
    id: "00000000-0000-4000-b000-000000000015",
    username: "lucas-van-der-berg",
    name: "Lucas van der Berg",
    country: "NL",
    avatarId: "podium",
    style: "simple",
    createdAtOffsetDays: 17,
  },

  // ───── Norteamérica / país anfitrión (4) ─────
  {
    id: "00000000-0000-4000-b000-000000000016",
    username: "tyler-brooks",
    name: "Tyler Brooks",
    country: "US",
    avatarId: "oracle",
    style: "simple",
    createdAtOffsetDays: 30,
  },
  {
    id: "00000000-0000-4000-b000-000000000017",
    username: "ashley-reyes",
    name: "Ashley Reyes",
    country: "US",
    avatarId: "champion",
    style: "simple",
    createdAtOffsetDays: 16,
  },
  {
    id: "00000000-0000-4000-b000-000000000018",
    username: "emma-thompson",
    name: "Emma Thompson",
    country: "CA",
    avatarId: "duel",
    style: "simple",
    createdAtOffsetDays: 14,
  },
  {
    id: "00000000-0000-4000-b000-000000000019",
    username: "carlos-mendoza",
    name: "Carlos Mendoza",
    country: "MX",
    avatarId: "podium",
    style: "mixed",
    createdAtOffsetDays: 11,
  },

  // ───── África (3) ─────
  {
    id: "00000000-0000-4000-b000-000000000020",
    username: "omar-benali",
    name: "Omar Benali",
    country: "MA",
    avatarId: "champion",
    style: "daredevil",
    createdAtOffsetDays: 22,
  },
  {
    id: "00000000-0000-4000-b000-000000000021",
    username: "cheikh-diop",
    name: "Cheikh Diop",
    country: "SN",
    avatarId: "duel",
    style: "simple",
    createdAtOffsetDays: 19,
  },
  {
    id: "00000000-0000-4000-b000-000000000022",
    username: "layla-haddad",
    name: "Layla Haddad",
    country: "EG",
    avatarId: "oracle",
    style: "simple",
    createdAtOffsetDays: 12,
  },

  // ───── Asia (3) ─────
  {
    id: "00000000-0000-4000-b000-000000000023",
    username: "yuki-tanaka",
    name: "Yuki Tanaka",
    country: "JP",
    avatarId: "podium",
    style: "simple",
    createdAtOffsetDays: 26,
  },
  {
    id: "00000000-0000-4000-b000-000000000024",
    username: "minjun-park",
    name: "Min-jun Park",
    country: "KR",
    avatarId: "champion",
    style: "simple",
    createdAtOffsetDays: 9,
  },
  {
    id: "00000000-0000-4000-b000-000000000025",
    username: "reza-ahmadi",
    name: "Reza Ahmadi",
    country: "IR",
    avatarId: "duel",
    style: "mixed",
    createdAtOffsetDays: 7,
  },

  // ───── Otros (2) ─────
  {
    id: "00000000-0000-4000-b000-000000000026",
    username: "aleksandr-volkov",
    name: "Aleksandr Volkov",
    country: "RU",
    avatarId: "oracle",
    style: "simple",
    createdAtOffsetDays: 36,
  },
  {
    id: "00000000-0000-4000-b000-000000000027",
    username: "ahmad-almahmoud",
    name: "Ahmad Al-Mahmoud",
    country: "SA",
    avatarId: "duel",
    style: "simple",
    createdAtOffsetDays: 5,
  },
];

/**
 * Email sintético del bot. Nunca resuelve DNS (no hay registros MX
 * para `bots.arenacup26.com`). Cumple el constraint NOT NULL UNIQUE
 * de `users.email` y permite hacer lookup por email si fuera
 * necesario para operativa.
 */
export function botEmail(username: string): string {
  return `${username}@bots.arenacup26.com`;
}
