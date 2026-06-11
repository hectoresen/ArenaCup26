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
      return "/social";
    case "achievement_unlocked":
      return "/logros";
    case "prediction_sent":
    case "prediction_locked":
    case "match_finished":
      return item.matchId ? `/partidos/${item.matchId}` : null;
    case "system":
      return null;
    case "admin_broadcast":
      // Los avisos del equipo (broadcast/individual desde admin) no
      // tienen destino — el contenido vive en title+body. La campana
      // renderiza un modal con el mensaje completo cuando el body
      // excede el ancho del dropdown (notification-bell.tsx).
      return null;
    case "group_invited":
    case "group_joined":
    case "group_left":
    case "group_expelled":
    case "group_admin_transferred":
    case "group_deleted":
      // Los kinds `group_*` llevan a la sección Social; la card que
      // se renderiza dentro de /social hace el deep-link al grupo
      // concreto si la noti incluye contexto. El admin transferido y
      // los miembros van todos al hub para simplificar.
      return "/social";
  }
}
