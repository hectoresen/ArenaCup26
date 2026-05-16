import type { NotificationItem } from "./types";

/**
 * Decide a dónde lleva el click sobre una notificación. La tabla
 * `notifications` solo guarda `matchId` y `achievementId`; el resto
 * de tipos (`friend_request`, `friend_accepted`, `system`) no tienen
 * un objeto asociado por columna, así que mapeamos aquí.
 *
 * Reglas (cubiertas por tests):
 *  - `prediction_sent`, `prediction_locked`, `match_finished` → al
 *    detalle del partido si tenemos `matchId`; `null` si no.
 *  - `achievement_unlocked` → a la galería `/logros`. No usamos
 *    `achievementId` para construir un deep-link porque la página
 *    `/logros` no tiene anchor por logro hoy — esto puede cambiar
 *    cuando aterrice `add-achievement-share-deeplink`.
 *  - `friend_request`, `friend_accepted` → a `/amigos` (bandeja
 *    + lista).
 *  - `system` → sin destino. La fila se renderiza como `<div>` no
 *    clickable.
 */
export function resolveNotificationHref(item: NotificationItem): string | null {
  switch (item.kind) {
    case "friend_request":
    case "friend_accepted":
      return "/amigos";
    case "achievement_unlocked":
      return "/logros";
    case "prediction_sent":
    case "prediction_locked":
    case "match_finished":
      return item.matchId ? `/partidos/${item.matchId}` : null;
    case "system":
      return null;
  }
}
