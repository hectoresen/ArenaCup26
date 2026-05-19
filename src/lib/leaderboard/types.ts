export type Player = {
  id: string;
  /**
   * Slug del usuario para construir el link a `/u/<username>`. `null`
   * si el row es legacy y no tiene username (no debería pasar — todos
   * los usuarios reales hacen el backfill de username en signup).
   */
  username: string | null;
  name: string;
  countryCode: string;
  countryName: string;
  flag: string;
  points: number;
  streak: number;
  correctCount: number;
  rank: number;
  previousRank: number;
  /**
   * `true` si el user ha hecho cualquier request server-side en
   * las últimas 24h (campo `users.last_active_at`). El layout
   * `(app)` lo actualiza con throttle de 5 min cada visita.
   * Usado para el "puntito verde" en `<RankRow>`.
   */
  isOnline: boolean;
  /**
   * ID del avatar elegido de la galería SVG (`/public/avatars`). Si
   * está set y resuelve, `<RankRow>` y `<PodiumCard>` muestran el
   * SVG. Si es null, fallback a `image` (Google) o iniciales.
   */
  avatarId: string | null;
  /** Imagen de Google del user. Fallback si `avatarId` no resuelve. */
  image: string | null;
};

export type LeaderboardSnapshot = {
  generatedAt: string;
  players: Player[];
};

export type LeaderboardEvent =
  | {
      type: "score-update";
      playerId: string;
      pointsDelta: number;
      newRank: number;
    }
  | { type: "snapshot"; snapshot: LeaderboardSnapshot };
