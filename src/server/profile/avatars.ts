/**
 * Galería curada de avatares. Cada user puede elegir uno de aquí o
 * mantener el de Google (default cuando `users.avatar_id IS NULL`).
 *
 * Decisión: usamos emojis grandes en lugar de subir fotos para
 * evitar moderar contenido inapropiado. La galería se renderiza
 * dentro de un círculo del color de fondo del perfil.
 *
 * IDs estables (`avatar_id` en BD) para que el resultado no cambie
 * si reordenamos esta lista. No usar el índice — usar el id.
 */
export type Avatar = {
  /** ID estable persistido en `users.avatar_id`. */
  id: string;
  /** Emoji visible. */
  emoji: string;
  /** Etiqueta accesible (aria-label). */
  label: string;
};

export const AVATAR_GALLERY: Avatar[] = [
  { id: "ball", emoji: "⚽", label: "Balón" },
  { id: "trophy", emoji: "🏆", label: "Trofeo" },
  { id: "medal-gold", emoji: "🥇", label: "Medalla oro" },
  { id: "fire", emoji: "🔥", label: "Fuego" },
  { id: "rocket", emoji: "🚀", label: "Cohete" },
  { id: "star", emoji: "⭐", label: "Estrella" },
  { id: "crown", emoji: "👑", label: "Corona" },
  { id: "lightning", emoji: "⚡", label: "Rayo" },
  { id: "gem", emoji: "💎", label: "Diamante" },
  { id: "target", emoji: "🎯", label: "Diana" },
  { id: "smile", emoji: "😎", label: "Cool" },
  { id: "tongue", emoji: "😜", label: "Lengua" },
  { id: "robot", emoji: "🤖", label: "Robot" },
  { id: "alien", emoji: "👽", label: "Alien" },
  { id: "ninja", emoji: "🥷", label: "Ninja" },
  { id: "fox", emoji: "🦊", label: "Zorro" },
  { id: "tiger", emoji: "🐯", label: "Tigre" },
  { id: "lion", emoji: "🦁", label: "León" },
  { id: "panda", emoji: "🐼", label: "Panda" },
  { id: "wolf", emoji: "🐺", label: "Lobo" },
  { id: "horse", emoji: "🐴", label: "Caballo" },
  { id: "shark", emoji: "🦈", label: "Tiburón" },
  { id: "dragon", emoji: "🐉", label: "Dragón" },
  { id: "ghost", emoji: "👻", label: "Fantasma" },
];

export function getAvatar(id: string | null | undefined): Avatar | null {
  if (!id) return null;
  return AVATAR_GALLERY.find((a) => a.id === id) ?? null;
}
