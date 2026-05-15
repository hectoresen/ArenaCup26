import { DEFAULT_USER_PRIVACY, type UserPrivacy } from "@/server/db/schema";

export { DEFAULT_USER_PRIVACY };
export type { UserPrivacy };

/**
 * Normaliza una fila de BD a un objeto `UserPrivacy` válido. Defensa
 * frente a usuarios pre-existentes sin la columna `privacy` rellena,
 * o filas con shape parcial: cualquier campo ausente se rellena con
 * el default público.
 */
export function normalizePrivacy(raw: unknown): UserPrivacy {
  if (!raw || typeof raw !== "object") return DEFAULT_USER_PRIVACY;
  const r = raw as Partial<UserPrivacy>;
  return {
    visibility:
      r.visibility === "private" || r.visibility === "friends_only"
        ? r.visibility
        : "public",
    showName: r.showName !== false,
    showCountry: r.showCountry !== false,
    showImage: r.showImage !== false,
    showPoints: r.showPoints !== false,
    showAchievements: r.showAchievements !== false,
  };
}

/**
 * Decide si el `viewerId` puede ver el perfil del `ownerId` dado el
 * `visibility` configurado.
 *
 *  - `public`: siempre.
 *  - `private`: solo el propio dueño.
 *  - `friends_only`: solo el dueño hoy. Cuando aterrice
 *    `add-social-friends`, hará un check en `friendships`.
 */
export function canViewProfile(
  privacy: UserPrivacy,
  ownerId: string,
  viewerId: string | null,
): boolean {
  if (privacy.visibility === "public") return true;
  if (viewerId === null) return false;
  if (viewerId === ownerId) return true;
  // friends_only: TODO check tabla friendships cuando exista.
  return false;
}

/**
 * Decide cómo mostrar un nombre dado los toggles del owner. Si
 * `showName` es false, devolvemos "Jugador {primera inicial}" para
 * mantener identidad mínima sin exponer nombre real.
 */
export function maskName(name: string | null | undefined, privacy: UserPrivacy): string {
  const safe = name?.trim() || "Jugador";
  if (privacy.showName) return safe;
  const initial = safe.charAt(0).toUpperCase();
  return `Jugador ${initial}`;
}
