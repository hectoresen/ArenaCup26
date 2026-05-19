/**
 * Catálogo canónico de los 24 logros de ArenaCup26.
 *
 * Source of truth en código. Refleja `docs/achievements.md` 1:1.
 * Cualquier cambio aquí requiere actualizar el doc y abrir una propuesta
 * `update-achievements-<motivo>`.
 *
 * El campo `iconId` apunta al `<symbol>` del SVG sprite definido en
 * `docs/achievements-reference.html` (que el componente `<AchievementCard />`
 * portará a Tailwind/React cuando aterrice `add-achievements`).
 *
 * `title` y `description` están en español (idioma por defecto del producto).
 * Cuando aterrice la UI de logros, los strings visibles se localizan vía
 * `messages/{locale}.json` namespace `achievements.<id>.title|description`,
 * con fallback a estos campos si la clave no existe.
 */

export type AchievementTier = "common" | "rare" | "epic" | "legendary" | "mythic" | "goat";

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  isShareable: boolean;
  iconId: string;
  sortOrder: number;
};

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  // ───── Común (6) ─────
  {
    id: "first-hit",
    title: "Primer Acierto",
    description: "Acierta tu primera predicción del torneo (simple, exacto o doble).",
    tier: "common",
    isShareable: false,
    iconId: "ico-dart",
    sortOrder: 1,
  },
  {
    id: "good-eye",
    title: "Buen Ojo",
    description: "Acumula 10 aciertos a lo largo del torneo.",
    tier: "common",
    isShareable: false,
    iconId: "ico-check10",
    sortOrder: 2,
  },
  {
    id: "group-analyst",
    title: "Analista de Grupos",
    description: "Predice al menos 10 partidos de la fase de grupos.",
    tier: "common",
    isShareable: false,
    iconId: "ico-binoculars",
    sortOrder: 3,
  },
  {
    id: "first-hundred",
    title: "Primer Centenar",
    description: "Acumula 100 puntos oficiales.",
    tier: "common",
    isShareable: false,
    iconId: "ico-coin",
    sortOrder: 4,
  },
  {
    id: "better-with-friends",
    title: "Mejor con Amigos",
    description: "Un usuario referido acierta su primera predicción.",
    tier: "common",
    isShareable: false,
    iconId: "ico-invite",
    sortOrder: 5,
  },
  {
    id: "five-of-five",
    title: "Cinco de Cinco",
    description: "Acierta el marcador exacto en 5 partidos distintos.",
    tier: "common",
    isShareable: false,
    iconId: "ico-five-exact",
    sortOrder: 6,
  },
  {
    id: "team-spirit",
    title: "Espíritu de Equipo",
    description: "Crea o únete a tu primer grupo de competición.",
    tier: "common",
    isShareable: false,
    iconId: "ico-team",
    // sortOrder 25 → render al final del tier común (el orden global
    // por sortOrder se reagrupa por tier en el UI; este logro entra
    // como séptimo común). No usamos 6.5 fraccional para mantener la
    // numeración entera del resto del catálogo.
    sortOrder: 25,
  },

  // ───── Poco común (4) ─────
  {
    id: "power-200",
    title: "200 de Potencia",
    description: "Supera los 200 puntos oficiales acumulados.",
    tier: "rare",
    isShareable: false,
    iconId: "ico-medal",
    sortOrder: 7,
  },
  {
    id: "on-fire",
    title: "En Llamas",
    description: "Alcanza el hito de 5 aciertos consecutivos en una racha.",
    tier: "rare",
    isShareable: false,
    iconId: "ico-flame",
    sortOrder: 8,
  },
  {
    id: "exact-shot",
    title: "Exacto",
    description: "Acierta el marcador exacto de un partido.",
    tier: "rare",
    isShareable: false,
    iconId: "ico-crosshair",
    sortOrder: 9,
  },
  {
    id: "top-100",
    title: "Top 100",
    description: "Entra al menos una vez en el top 100 del ranking global.",
    tier: "rare",
    isShareable: false,
    iconId: "ico-top100",
    sortOrder: 10,
  },

  // ───── Épico (6) ─────
  {
    id: "total-strategist",
    title: "Estratega Total",
    description: "Predice todos los partidos de la fase de grupos sin excepción.",
    tier: "epic",
    isShareable: false,
    iconId: "ico-clipboard",
    sortOrder: 11,
  },
  {
    id: "half-world",
    title: "Medio Mundo",
    description: "Realiza predicciones en al menos el 50% de los partidos del Mundial.",
    tier: "epic",
    isShareable: false,
    iconId: "ico-halfglobe",
    sortOrder: 12,
  },
  {
    id: "elite-shooter",
    title: "Tirador de Élite",
    description: "Acierta el marcador exacto en 10 partidos distintos.",
    tier: "epic",
    isShareable: false,
    iconId: "ico-crosshair10",
    sortOrder: 13,
  },
  {
    id: "top-50",
    title: "Top 50",
    description: "Entra al menos una vez en el top 50 del ranking global.",
    tier: "epic",
    isShareable: false,
    iconId: "ico-top50",
    sortOrder: 14,
  },
  {
    id: "double-streak",
    title: "Doble Racha",
    description: "Consigue al menos 2 rachas que alcancen el hito de 5 a lo largo del torneo.",
    tier: "epic",
    isShareable: false,
    iconId: "ico-double-flame",
    sortOrder: 15,
  },
  {
    id: "the-step-before",
    title: "El Penúltimo Paso",
    description: "Acierta el resultado de una semifinal del Mundial.",
    tier: "epic",
    isShareable: false,
    iconId: "ico-bolt",
    sortOrder: 16,
  },

  // ───── Legendario (4) ─────
  {
    id: "seer",
    title: "Vidente",
    description: "Acierta el marcador exacto en 20 partidos distintos. Esto no es suerte.",
    tier: "legendary",
    isShareable: true,
    iconId: "ico-eye",
    sortOrder: 17,
  },
  {
    id: "top-10",
    title: "Top 10",
    description: "Entra al menos una vez en el top 10 del ranking global del Mundial.",
    tier: "legendary",
    isShareable: true,
    iconId: "ico-top10",
    sortOrder: 18,
  },
  {
    id: "world-citizen",
    title: "Ciudadano del Mundo",
    description: "Realiza predicciones en absolutamente todos los partidos del Mundial 2026.",
    tier: "legendary",
    isShareable: true,
    iconId: "ico-globe",
    sortOrder: 19,
  },
  {
    id: "the-prophet",
    title: "El Gran Profeta",
    description: "Acierta el marcador exacto de la Gran Final. Eres una leyenda.",
    tier: "legendary",
    isShareable: true,
    iconId: "ico-trophy",
    sortOrder: 20,
  },

  // ───── Mítico (3) ─────
  {
    id: "on-the-podium",
    title: "En el Podio",
    description: "Aparece al menos una vez en el top 3 del ranking durante el torneo.",
    tier: "mythic",
    isShareable: true,
    iconId: "ico-podium3",
    sortOrder: 21,
  },
  {
    id: "runner-up",
    title: "Subcampeón",
    description: "Llega a ocupar el top 2 del ranking en algún momento del Mundial.",
    tier: "mythic",
    isShareable: true,
    iconId: "ico-podium2",
    sortOrder: 22,
  },
  {
    id: "king-of-the-moment",
    title: "El Rey del Momento",
    description: "Ocupa el número 1 del ranking al menos una vez durante el torneo.",
    tier: "mythic",
    isShareable: true,
    iconId: "ico-crown",
    sortOrder: 23,
  },

  // ───── GOAT (1) ─────
  {
    id: "the-goat",
    title: "El Mayor de Todos",
    description:
      "Al finalizar el Mundial 2026 eres el número 1 absoluto del ranking. Solo puede haber uno.",
    tier: "goat",
    isShareable: true,
    iconId: "ico-goat",
    sortOrder: 24,
  },
];
