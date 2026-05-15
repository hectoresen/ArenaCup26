import { DEFAULT_USER_PRIVACY, type UserPrivacy } from "@/server/db/schema";

export { DEFAULT_USER_PRIVACY };
export type { UserPrivacy };

/**
 * Normaliza una fila de BD a un objeto `UserPrivacy` válido. Defensa
 * frente a usuarios pre-existentes con `privacy` ausente o con shape
 * antiguo (los toggles individuales `showName/showCountry/...` que se
 * eliminaron en 2026-05-15) — cualquier campo desconocido se ignora.
 */
export function normalizePrivacy(raw: unknown): UserPrivacy {
  if (!raw || typeof raw !== "object") return DEFAULT_USER_PRIVACY;
  const r = raw as Partial<UserPrivacy>;
  return {
    visibility:
      r.visibility === "private" || r.visibility === "friends_only"
        ? r.visibility
        : "public",
  };
}

/**
 * Decide si el `viewerId` puede ver el perfil del `ownerId` dado el
 * `visibility` configurado.
 *
 *  - `public`: siempre.
 *  - `private`: solo el propio dueño.
 *  - `friends_only`: el dueño o un amigo aceptado. El caller pasa el
 *    flag `isFriend` después de consultar la tabla `friendships`
 *    (`src/server/friends/queries.ts::areFriends`).
 *
 * Cuando devuelve `false`, la página `/u/<username>` debe mostrar el
 * cartel "Perfil privado" (no `notFound()`): el ranking sigue
 * enlazando a este path para todos los users, sea cual sea su
 * visibility.
 */
export function canViewProfile(
  privacy: UserPrivacy,
  ownerId: string,
  viewerId: string | null,
  isFriend = false,
): boolean {
  if (privacy.visibility === "public") return true;
  if (viewerId === null) return false;
  if (viewerId === ownerId) return true;
  if (privacy.visibility === "friends_only") return isFriend;
  // private: solo el dueño (cubierto arriba).
  return false;
}
