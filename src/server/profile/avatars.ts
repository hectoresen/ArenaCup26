/**
 * Galería de avatares — **personajes SVG ilustrados**.
 *
 * Galería de personajes con temática futbolera:
 *  - `champion` — corona + balón + confetti (campeón).
 *  - `duel`     — dos jugadores cara a cara (competición).
 *  - `podium`   — tres personajes en el podio (logros).
 *  - `oracle`   — bola de cristal con balón dentro (predictor).
 *  - `goal`     — celebración tras marcar (la euforia del acierto).
 *  - `smug`     — sonrisa engreída (el listillo que las clava todas).
 *  - `ref`      — árbitro con silbato (el legalista del grupo).
 *  - `angry`    — cara cabreada (el que se enrabieta cuando falla).
 *
 * Cada SVG es 256×256, ya clipeado a círculo internamente
 * (`clipPath`), así que se renderiza directo sin máscara externa.
 * Servidos como assets estáticos desde `/public/avatars/<id>.svg`.
 *
 * Convención: `avatar_id` (PK estable) en BD es el id del avatar.
 * No usar el índice del array — `id` es lo que persiste.
 *
 * Backwards compat: usuarios con `avatar_id` de la galería anterior
 * (ball/trophy/etc) reciben `null` de `getAvatar()` → fallback a la
 * foto de Google. Cuando vuelvan a editar su perfil eligen un SVG
 * nuevo y se overwritea.
 */
export type Avatar = {
  /** ID estable persistido en `users.avatar_id`. */
  id: string;
  /** URL pública del SVG (servido desde `/public/avatars/`). */
  src: string;
  /** Etiqueta accesible (aria-label) y para el picker. */
  label: string;
  /** Subtítulo corto del personaje en el picker. */
  description: string;
};

export const AVATAR_GALLERY: Avatar[] = [
  {
    id: "champion",
    src: "/avatars/champion.svg",
    label: "Campeón",
    description: "Corona, confetti, gloria. Para los que apuntan al #1.",
  },
  {
    id: "duel",
    src: "/avatars/duel.svg",
    label: "Duelo",
    description: "Cara a cara en el campo. La rivalidad sana.",
  },
  {
    id: "podium",
    src: "/avatars/podium.svg",
    label: "Podio",
    description: "Oro, plata y bronce. Llegar arriba se celebra.",
  },
  {
    id: "oracle",
    src: "/avatars/oracle.svg",
    label: "Oráculo",
    description: "Bola de cristal y balón. Para los que predicen sin fallo.",
  },
  {
    id: "goal",
    src: "/avatars/goal.svg",
    label: "Gol",
    description: "La euforia tras marcar. Para celebrar cada acierto.",
  },
  {
    id: "smug",
    src: "/avatars/smug.svg",
    label: "Chulito",
    description: "La sonrisa del que sabía que iba a acertar.",
  },
  {
    id: "ref",
    src: "/avatars/ref.svg",
    label: "Árbitro",
    description: "Silbato en mano. El que conoce todas las reglas.",
  },
  {
    id: "angry",
    src: "/avatars/angry.svg",
    label: "Cabreado",
    description: "Cuando el VAR te roba un acierto cantado.",
  },
];

/**
 * Resuelve un `avatarId` a su entry del catálogo. Devuelve `null` si
 * el id no existe (avatar viejo de la galería de emojis, o input
 * basura). El caller debe hacer fallback a `image` (Google) o
 * placeholder genérico.
 */
export function getAvatar(id: string | null | undefined): Avatar | null {
  if (!id) return null;
  return AVATAR_GALLERY.find((a) => a.id === id) ?? null;
}
