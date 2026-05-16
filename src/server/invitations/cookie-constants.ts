/**
 * Constantes Edge-safe del flujo de cookie de invite. Sin imports a
 * Drizzle/Node — para que `middleware.ts` (Edge runtime) pueda
 * usarlos sin arrastrar todo el bundle del cliente DB.
 *
 * Las queries asociadas viven en `./cookie.ts` (Node runtime).
 */

/** Nombre canónico de la cookie httpOnly del token de invitación. */
export const INVITE_COOKIE = "wm_invite_token";

/** 30 días — el visitante puede tardar en decidirse a registrarse. */
export const INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
