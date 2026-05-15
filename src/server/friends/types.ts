export type FriendshipStatus = "pending" | "accepted" | "blocked";

/**
 * Estado lógico de la relación entre el viewer y otro user, calculado
 * mirando ambas direcciones en la tabla `friendships`. Sirve para
 * decidir qué CTA mostrar en `/u/<username>`.
 *
 *  - **none**: no hay fila, se puede enviar solicitud.
 *  - **pending-out**: el viewer envió solicitud, espera respuesta.
 *  - **pending-in**: el otro user envió solicitud, viewer puede
 *    aceptar/rechazar.
 *  - **accepted**: son amigos.
 *  - **blocked-by-me**: el viewer ha bloqueado al otro.
 *  - **blocked-by-them**: el otro ha bloqueado al viewer.
 *  - **self**: mismo user; no aplica CTA.
 */
export type ViewerRelation =
  | "none"
  | "pending-out"
  | "pending-in"
  | "accepted"
  | "blocked-by-me"
  | "blocked-by-them"
  | "self";

export type Friend = {
  /** UUID del amigo (no del viewer). */
  userId: string;
  name: string;
  username: string | null;
  countryCode: string | null;
  image: string | null;
  avatarId: string | null;
  points: number;
  /** ISO timestamp del momento en que la amistad se aceptó. */
  acceptedAt: Date;
};

export type FriendRequest = {
  /** UUID de la fila en `friendships` — necesario para accept/reject. */
  friendshipId: string;
  /** UUID del user que envió la solicitud. */
  fromUserId: string;
  fromName: string;
  fromUsername: string | null;
  fromCountryCode: string | null;
  fromImage: string | null;
  fromAvatarId: string | null;
  createdAt: Date;
};
