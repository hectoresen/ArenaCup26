import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Privacy preferences que vive en `users.privacy` (JSONB). Default:
 * `visibility = 'public'` (cualquiera ve el perfil en `/u/<username>`).
 *
 * El ranking global es **inamovible** — no se ve afectado por este
 * setting. La información básica (nombre, bandera, puntos, avatar)
 * siempre aparece en el ranking, sea cual sea el `visibility`. La
 * privacy únicamente decide si la página `/u/<username>` muestra el
 * perfil completo o el cartel "Perfil privado".
 *
 *  - `public`: cualquiera ve el perfil.
 *  - `friends_only`: solo amigos. Hasta que aterrice
 *    `add-social-friends`, se comporta como `private` (solo el dueño).
 *  - `private`: solo el dueño.
 *
 * Los antiguos toggles individuales (`showName`, `showCountry`,
 * `showImage`, `showPoints`, `showAchievements`) se eliminaron en
 * 2026-05-15: o muestras todo o no muestras nada — los toggles solo
 * añadían fricción a una decisión que se reduce a "perfil visitable
 * o no".
 */
export type UserPrivacy = {
  visibility: "public" | "friends_only" | "private";
  /**
   * Si `false`, el historial de predicciones del user NO se muestra
   * en su perfil público — el dueño sí lo ve siempre. Default `true`
   * (la mayoría de jugadores quiere presumir de sus aciertos).
   * Añadido 2026-05-18 en QA bloque 2.
   */
  showHistory: boolean;
};

export const DEFAULT_USER_PRIVACY: UserPrivacy = {
  visibility: "public",
  showHistory: true,
};

// ─── ENUMS ─────────────────────────────────────────────────

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled-tbd",
  "scheduled",
  "prediction-locked",
  "live",
  "finished",
  "postponed",
  "cancelled",
]);

export const matchStageEnum = pgEnum("match_stage", [
  "group",
  "round-of-16",
  "quarter",
  "semi",
  "final",
  "third-place",
  "regular-season",
]);

export const predictionKindEnum = pgEnum("prediction_kind", [
  "simple",
  "exact",
  "double-1x",
  "double-x2",
  "double-12",
]);

export const predictionWinnerEnum = pgEnum("prediction_winner", ["home", "away", "draw"]);

export const achievementTierEnum = pgEnum("achievement_tier", [
  "common",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "goat",
]);

export const pointEventKindEnum = pgEnum("point_event_kind", [
  "simple",
  "exact",
  "double",
  "combo",
  "poll",
  "referral",
]);

export const notificationKindEnum = pgEnum("notification_kind", [
  "prediction_sent",
  "prediction_locked",
  "match_finished",
  "achievement_unlocked",
  "system",
  // Broadcast del admin a todos los humanos. Aparece en la campana
  // como una notificación más. Sin push (decisión: simplicidad).
  "admin_broadcast",
  "friend_request",
  "friend_accepted",
  // ───── Grupos de competición (add-competition-groups, 2026-05-18) ─────
  "group_invited",
  "group_joined",
  "group_left",
  "group_expelled",
  "group_admin_transferred",
  "group_deleted",
]);

export const friendshipStatusEnum = pgEnum("friendship_status", ["pending", "accepted", "blocked"]);

export const groupVisibilityEnum = pgEnum("group_visibility", ["public", "private"]);
export const groupMemberRoleEnum = pgEnum("group_member_role", ["admin", "member"]);
export const groupInvitationStatusEnum = pgEnum("group_invitation_status", [
  "pending",
  "accepted",
  "rejected",
]);

/**
 * Paleta cerrada de colores temáticos para distinguir grupos
 * visualmente. Misma filosofía que `AVATAR_GALLERY`: galería curada
 * sin necesidad de upload de assets. Se valida en la server action
 * `createGroup` / `updateGroup`. Si el día de mañana queremos más
 * colores, se añade aquí y la UI los lee automáticamente.
 */
export const GROUP_COLORS = [
  "gold",
  "blue",
  "purple",
  "green",
  "orange",
  "red",
  "teal",
  "pink",
] as const;
export type GroupColor = (typeof GROUP_COLORS)[number];

// ─── USERS & AUTH (Auth.js compatible) ─────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // El adapter de Auth.js exige `name`, `email`, `emailVerified` e `image`.
    // `name` lo dejamos nullable porque algunos providers no lo entregan, aunque
    // Google sí. `emailVerified` se rellena cuando el provider lo confirma.
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
    image: text("image"),
    // Campos propios del dominio (no requeridos por Auth.js).
    country: varchar("country", { length: 3 }),
    username: varchar("username", { length: 20 }).unique(),
    // Preferencias de privacidad por usuario. JSONB para futura
    // extensibilidad sin migraciones. Default: público. Tipado en
    // `UserPrivacy` arriba — actualmente solo `visibility`.
    privacy: jsonb("privacy")
      .$type<UserPrivacy>()
      .notNull()
      .default(sql`'{"visibility":"public"}'::jsonb`),
    // Marca temporal del completado del wizard /bienvenido. Si es
    // null, el layout `(app)` redirige al usuario al wizard antes
    // de entrar al panel. Idempotente: re-renderizar /bienvenido no
    // resetea el valor existente.
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    // Identificador del avatar elegido de la galería pre-curada
    // (ver `src/server/profile/avatars.ts`). Si es `null`, fallback
    // a `image` (Google). Editable desde el perfil con cooldown 48h.
    avatarId: varchar("avatar_id", { length: 32 }),
    // Última vez que el user cambió su nombre. Cooldown de 48h para
    // evitar spam de cambios. `null` = nunca lo ha cambiado.
    nameChangedAt: timestamp("name_changed_at", { withTimezone: true }),
    // Última vez que el user cambió su avatar (galería o vuelta al
    // de Google). Mismo cooldown 48h.
    avatarChangedAt: timestamp("avatar_changed_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Bot flag — sintético poblado por el seed (`add-bot-users`,
     * 2026-05-19). `true` significa que esta fila NO es un humano:
     * sin email real, sin OAuth account, sin push subscriptions.
     * Reusa toda la infra para poblar el ranking durante cold-start.
     * NUNCA se expone en API pública ni se muestra en UI — un user
     * real no distingue un bot de un humano.
     */
    isBot: boolean("is_bot").notNull().default(false),
    /**
     * Flag de admin del panel de administración (subdomain
     * `admin.arenacup26.com`). Default false — solo se setea a true
     * manualmente vía psql para users de confianza. La auth gate
     * requiere ADEMÁS que el email esté en `ADMIN_EMAILS` allowlist
     * en código (doble llave) para mitigar escalado de privilegios
     * por SQL injection futura. Ver `src/lib/admin-allowlist.ts`.
     */
    isAdmin: boolean("is_admin").notNull().default(false),
    /**
     * Si está set y `> now()`, el user no puede iniciar sesión
     * (banneado por el admin). `'9999-12-31T23:59:59Z'` =
     * permanente, fecha concreta = ban temporal. Default NULL
     * (no banneado).
     */
    bannedUntil: timestamp("banned_until", { withTimezone: true }),
  },
  (table) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
    // Index parcial: acelera filtros internos `WHERE is_bot=true`
    // (admin/analytics) sin penalizar reads de users reales.
    isBotIdx: index("users_is_bot_idx").on(table.isBot).where(sql`${table.isBot} = true`),
    isAdminIdx: index("users_is_admin_idx").on(table.isAdmin).where(sql`${table.isAdmin} = true`),
  }),
);

// Las columnas siguen el contrato del Drizzle adapter de Auth.js, que exige
// los nombres JS en snake_case para los campos OAuth (refresh_token, etc.).
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

/**
 * Tabla requerida por el contrato del DrizzleAdapter de Auth.js v5
 * para soportar el provider de email/passwordless. Hoy NO la usamos
 * (solo Google OAuth) y permanece vacía en runtime. Se mantiene en
 * el schema por dos razones:
 *
 *  1. La firma `verificationTokensTable: verificationTokens` del
 *     adapter espera una referencia válida; quitarla obligaría a
 *     verificar la compatibilidad con cada upgrade de Auth.js.
 *  2. Sin staging real (1 entorno = prod), un `DROP TABLE` en
 *     migration tiene riesgo neto > 0 para un beneficio cosmético.
 *
 * Si en el futuro se activa email auth (magic links), la tabla ya
 * está lista. Si no, sigue siendo ~24 bytes de overhead y nada más.
 */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);

export const usernameHistory = pgTable(
  "username_history",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    oldUsername: varchar("old_username", { length: 20 }).notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.oldUsername] }),
    oldUsernameIdx: uniqueIndex("username_history_old_username_idx").on(table.oldUsername),
  }),
);

// ─── TEAMS & MATCHES ───────────────────────────────────────

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 3 }).notNull().unique(),
  name: text("name").notNull(),
  flag: text("flag"),
});

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stage: matchStageEnum("stage").notNull(),
    homeTeamId: uuid("home_team_id").references(() => teams.id),
    awayTeamId: uuid("away_team_id").references(() => teams.id),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    status: matchStatusEnum("status").notNull().default("scheduled-tbd"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    homeScoreExtra: integer("home_score_extra"),
    awayScoreExtra: integer("away_score_extra"),
    penaltyWinnerTeamId: uuid("penalty_winner_team_id").references(() => teams.id),
    /**
     * Minuto en juego del partido. Solo poblado mientras
     * `status IN ('live','extra_time','penalty_shootout')` (api-football
     * `fixture.status.elapsed`). En finished / programado queda en
     * NULL — el dato relevante pasa a ser el marcador o el kickoff.
     */
    minute: integer("minute"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("matches_status_idx").on(table.status),
    kickoffIdx: index("matches_kickoff_idx").on(table.kickoffAt),
  }),
);

// ─── EXTERNAL ID MAPPING (provider → BD) ──────────────────

// Tabla de mapping team-by-team. Múltiples providers conviven sin tocar
// la tabla `teams`. La PK compuesta `(source, external_id)` garantiza
// que un mismo external_id no se duplica para un mismo provider, pero
// sí puede repetirse entre providers (api-football "6" ≠ live-score "6").
export const teamExternalIds = pgTable(
  "team_external_ids",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.source, table.externalId] }),
    teamIdx: index("team_external_ids_team_idx").on(table.teamId),
  }),
);

// Mapping match-by-match. Mismo patrón. Necesario para que el upsert
// del pipeline sepa qué fila de `matches` actualizar al recibir el
// snapshot del provider.
export const matchExternalIds = pgTable(
  "match_external_ids",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.source, table.externalId] }),
    matchIdx: index("match_external_ids_match_idx").on(table.matchId),
  }),
);

// ─── PREDICTIONS ───────────────────────────────────────────

export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    kind: predictionKindEnum("kind").notNull(),
    predictedWinner: predictionWinnerEnum("predicted_winner"),
    predictedHomeScore: integer("predicted_home_score"),
    predictedAwayScore: integer("predicted_away_score"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
  },
  (table) => ({
    userMatchIdx: uniqueIndex("predictions_user_match_idx").on(table.userId, table.matchId),
  }),
);

// ─── POINTS & EVENTS ───────────────────────────────────────

export const userPoints = pgTable("user_points", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  totalPoints: integer("total_points").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  // Máximo histórico de la racha. Se actualiza en
  // `processFinishedMatch` cuando `streak > streakMax`. Usado como
  // segundo criterio del desempate del ranking (docs/scoring.md §X).
  streakMax: integer("streak_max").notNull().default(0),
  // Cantidad de hits "high-quality" (kind = "simple" o "exact").
  // Tercer criterio del desempate: predicciones simples/exactas
  // tienen más peso que dobles. Se incrementa en
  // `processFinishedMatch` cuando un user acierta con kind simple
  // o exact (no se incrementa con `double-*`).
  simpleHits: integer("simple_hits").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pointEvents = pgTable(
  "point_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
    kind: pointEventKindEnum("kind").notNull(),
    points: integer("points").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("point_events_user_idx").on(table.userId),
  }),
);

// ─── NOTIFICATIONS ─────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    // `title` y `body` se guardan en es (idioma por defecto). En el
    // futuro podemos guardar un `templateKey` + `params` para
    // renderizar en el locale del usuario al leer.
    title: text("title").notNull(),
    body: text("body"),
    // Referencias opcionales para deep-link desde el dropdown.
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
    achievementId: text("achievement_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("notifications_user_created_idx").on(table.userId, table.createdAt),
    userUnreadIdx: index("notifications_user_unread_idx").on(table.userId, table.readAt),
  }),
);

// ─── ACHIEVEMENTS ──────────────────────────────────────────

export const achievementDefinitions = pgTable("achievement_definitions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tier: achievementTierEnum("tier").notNull(),
  isShareable: boolean("is_shareable").notNull().default(false),
  iconId: text("icon_id"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id")
      .notNull()
      .references(() => achievementDefinitions.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.achievementId] }),
  }),
);

/**
 * Link de invitación generado por un user. El `token` se usa como
 * slug del link público (`/?invite=<token>`); es alfanumérico,
 * pseudo-random y único globalmente.
 *
 *  - `max_uses = 0` → ilimitado.
 *  - `uses` se incrementa por cada redención exitosa.
 *  - `revoked_at` set → el link no acepta más redenciones (el dueño
 *    lo "rescindió" desde la UI). No borramos la fila para conservar
 *    histórico de redenciones pasadas.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    maxUses: integer("max_uses").notNull().default(0),
    uses: integer("uses").notNull().default(0),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueToken: uniqueIndex("invitations_unique_token").on(table.token),
    inviterIdx: index("invitations_inviter_idx").on(table.inviterId),
  }),
);

/**
 * Una fila por cada user que ha redimido un link. La unicidad por
 * `invitee_id` evita que un user redima dos links distintos (decisión
 * de producto: cada user "pertenece" a un solo inviter).
 *
 * `first_hit_at` se rellena cuando el invitado acierta su PRIMERA
 * predicción. Ese evento dispara el pago de +10 puntos al inviter
 * y desbloquea `better-with-friends`. La columna nullable + el
 * `WHERE first_hit_at IS NULL` en el hook del pipeline garantiza
 * idempotencia: aciertos sucesivos del invitee no vuelven a pagar.
 */
export const invitationRedemptions = pgTable(
  "invitation_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    inviteeId: uuid("invitee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    firstHitAt: timestamp("first_hit_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueInvitee: uniqueIndex("invitation_redemptions_unique_invitee").on(table.inviteeId),
    invitationIdx: index("invitation_redemptions_invitation_idx").on(table.invitationId),
    inviterIdx: index("invitation_redemptions_inviter_idx").on(table.inviterId),
  }),
);

/**
 * Suscripción web push del user a un device/browser concreto. Un
 * user puede tener N filas (móvil + desktop + tablet…). El
 * `endpoint` es único globalmente — si el browser regenera la
 * subscripción, la nueva sustituye a la anterior (ON CONFLICT).
 *
 * Se elimina al perder permiso (`unsubscribePush`) o al fallar el
 * envío con 410 Gone (subscription invalidated por el provider).
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Endpoint URL del push service (FCM/Mozilla/Apple). Único global. */
    endpoint: text("endpoint").notNull(),
    /** P-256 ECDH public key del browser, base64url. */
    p256dh: text("p256dh").notNull(),
    /** Auth secret del browser, base64url. */
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => ({
    uniqueEndpoint: uniqueIndex("push_subscriptions_unique_endpoint").on(table.endpoint),
    userIdIdx: index("push_subscriptions_user_id_idx").on(table.userId),
  }),
);

/**
 * Snapshot diario del ranking por user. Una fila por (`user_id`,
 * `snapshot_date`). El cron `/api/cron/snapshot-ranking` corre a las
 * 00:05 UTC y graba el rank + puntos actuales de cada user.
 *
 * Se usa para:
 *  - Calcular `rankDelta` (variación 7 días) en la card "Tu posición"
 *    del dashboard.
 *  - Renderizar la sparkline (últimos 7 puntos del rank histórico).
 *
 * Como cada user tiene una fila al día, una temporada de Mundial (~30
 * días) deja ~30 filas/user. Con 1k users activos = 30k filas/mes,
 * totalmente manejable. Para limpieza más adelante (>90 días),
 * añadir un job de pruning.
 */
export const rankingSnapshots = pgTable(
  "ranking_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Rank 1-based al cierre del día. Se calcula con el mismo
     * tie-break que `getRealSnapshot` (points → streakMax →
     * simpleHits → predictionsCount → createdAt).
     */
    rank: integer("rank").notNull(),
    totalPoints: integer("total_points").notNull(),
    /** UTC date (no timezone) — la clave de unicidad de un snapshot. */
    snapshotDate: timestamp("snapshot_date", { mode: "date", withTimezone: false }).notNull(),
    /** Timestamp exacto de inserción. Solo para debugging. */
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueDay: uniqueIndex("ranking_snapshots_unique_day").on(table.userId, table.snapshotDate),
    dateIdx: index("ranking_snapshots_date_idx").on(table.snapshotDate),
  }),
);

/**
 * Relación de amistad asimétrica. `requester_id` envía la solicitud,
 * `addressee_id` la recibe. La aplicación normaliza la dirección al
 * consultar (la amistad lógica es bidireccional cuando `status =
 * 'accepted'`).
 *
 * - **pending**: solicitud abierta. Solo `addressee` puede aceptar.
 * - **accepted**: ambos son amigos. Filtros como `friends_only`
 *   resuelven contra esta fila en cualquier dirección.
 * - **blocked**: cualquiera de los dos bloquea al otro. Si se inserta
 *   con `requester=A, addressee=B`, B no puede ver el perfil de A ni
 *   enviarle solicitudes, y viceversa.
 *
 * Constraint único en `(requester_id, addressee_id)` evita duplicar
 * solicitudes pendientes en la misma dirección. La pareja inversa se
 * comprueba en la server action antes de insertar.
 */
export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => ({
    uniquePair: uniqueIndex("friendships_unique_pair").on(table.requesterId, table.addresseeId),
    addresseeIdx: index("friendships_addressee_idx").on(table.addresseeId),
    requesterIdx: index("friendships_requester_idx").on(table.requesterId),
  }),
);

// ─── GRUPOS DE COMPETICIÓN ─────────────────────────────────
// Sistema introducido por `add-competition-groups` (2026-05-18). El
// scoring es idéntico al global: cada grupo es un FILTRO+REORDER
// sobre el mismo `user_points`. No hay puntos paralelos.

/**
 * Grupo de competición. El creator inicial es el `admin`; la
 * relación se persiste en `group_memberships.role` para soportar
 * transfer de admin (siempre hay exactamente 1 admin por grupo
 * activo — invariante mantenido en las server actions).
 */
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    visibility: groupVisibilityEnum("visibility").notNull().default("private"),
    /**
     * Cap configurable por el admin en el rango [5, 100]. Validado
     * en `createGroup`/`updateGroup` (zod). Reducir por debajo del
     * count actual se bloquea en la action.
     */
    maxMembers: integer("max_members").notNull().default(25),
    /** Soft delete — preserva memberships con snapshot histórico. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    creatorIdx: index("groups_creator_idx").on(table.creatorId),
    visibilityIdx: index("groups_visibility_idx").on(table.visibility),
  }),
);

/**
 * Pertenencia de un user a un grupo. Al abandonar con la opción
 * "mantener perfil en ranking", `left_at` se set y los campos
 * `frozen_*` capturan el snapshot de los puntos en ese momento.
 * El ranking del grupo joinea: activos (puntos vivos de `user_points`)
 * con ex-miembros (puntos congelados de esta tabla).
 *
 * Cap 3 grupos activos por user — invariante mantenido en
 * `caps.canJoinAnotherGroup` antes de cualquier insert.
 */
export const groupMemberships = pgTable(
  "group_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupMemberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    /** Snapshot de puntos al `left_at`. NULL si miembro activo. */
    frozenPoints: integer("frozen_points"),
    frozenStreakMax: integer("frozen_streak_max"),
    frozenSimpleHits: integer("frozen_simple_hits"),
  },
  (table) => ({
    uniqueMembership: uniqueIndex("group_memberships_unique").on(table.groupId, table.userId),
    userIdx: index("group_memberships_user_idx").on(table.userId),
    groupActiveIdx: index("group_memberships_group_active_idx").on(table.groupId, table.leftAt),
  }),
);

/**
 * Invitación directa de admin a user concreto. Distinta de los
 * links de invitación (que son tokens reutilizables). El invitee
 * la acepta o la rechaza desde `/social`. Una invitación pending
 * por (group, invitee) es el invariante — al aceptar, status pasa
 * a 'accepted' y se crea la membership; al rechazar, queda como
 * 'rejected' para histórico (no se borra).
 */
export const groupInvitations = pgTable(
  "group_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeId: uuid("invitee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: groupInvitationStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => ({
    inviteeIdx: index("group_invitations_invitee_idx").on(table.inviteeId, table.status),
    groupIdx: index("group_invitations_group_idx").on(table.groupId),
  }),
);

/**
 * Links de invitación reutilizables (token compartible). A diferencia
 * de `group_invitations` (1-a-1), un link puede ser usado por N
 * personas (`max_uses = 0` ilimitado, o N concreto). El creador
 * puede revocar en cualquier momento (`revoked_at != null`).
 *
 * Cap 5 links activos (revoked_at IS NULL) por grupo — invariante
 * en `createLink`.
 */
export const groupLinks = pgTable(
  "group_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    /** Token aleatorio (UUID-like) que va en la URL `/social/grupos/unirse/<token>`. */
    token: text("token").notNull(),
    /** 0 = ilimitado, N = al alcanzar `uses = N` el link queda agotado. */
    maxUses: integer("max_uses").notNull().default(0),
    uses: integer("uses").notNull().default(0),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueToken: uniqueIndex("group_links_token_unique").on(table.token),
    groupActiveIdx: index("group_links_group_active_idx").on(table.groupId, table.revokedAt),
  }),
);

// ─── ADMIN ─────────────────────────────────────────────────

/**
 * Settings globales (singleton key/value). Una sola fila por key.
 * El valor es JSONB para permitir esquemas distintos por setting:
 *   - `maintenance` → `{ enabled: boolean, message: string | null }`
 *   - (futuro) `ramp_up`, `featured_match`, etc.
 *
 * Lectura en hot-path (banner global) — `key` indexado por PK ya
 * basta para latency O(1). Solo el admin escribe; los reads sin
 * cache valen para volumen actual.
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

/**
 * Audit log de cualquier acción admin (toggle mantenimiento, envío
 * de broadcast, ban de user, ajuste de puntos…). Append-only; no se
 * borra ni se actualiza. `payload` JSONB para diff/contexto.
 *
 * Indexado por `(admin_user_id, created_at)` para que el detalle de
 * "qué hizo Hector hoy" sea instantáneo, y por `created_at` solo
 * para el feed cronológico global del dashboard.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    adminCreatedIdx: index("admin_audit_log_admin_created_idx").on(
      table.adminUserId,
      table.createdAt,
    ),
    createdIdx: index("admin_audit_log_created_idx").on(table.createdAt),
  }),
);

// ─── RELATIONS ─────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  predictions: many(predictions),
  pointEvents: many(pointEvents),
  achievements: many(userAchievements),
  points: one(userPoints, {
    fields: [users.id],
    references: [userPoints.userId],
  }),
  usernameHistory: many(usernameHistory),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  homeMatches: many(matches, { relationName: "home" }),
  awayMatches: many(matches, { relationName: "away" }),
  externalIds: many(teamExternalIds),
}));

export const teamExternalIdsRelations = relations(teamExternalIds, ({ one }) => ({
  team: one(teams, {
    fields: [teamExternalIds.teamId],
    references: [teams.id],
  }),
}));

export const matchExternalIdsRelations = relations(matchExternalIds, ({ one }) => ({
  match: one(matches, {
    fields: [matchExternalIds.matchId],
    references: [matches.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, {
    fields: [matches.homeTeamId],
    references: [teams.id],
    relationName: "home",
  }),
  awayTeam: one(teams, {
    fields: [matches.awayTeamId],
    references: [teams.id],
    relationName: "away",
  }),
  penaltyWinner: one(teams, {
    fields: [matches.penaltyWinnerTeamId],
    references: [teams.id],
    relationName: "penaltyWinner",
  }),
  predictions: many(predictions),
  externalIds: many(matchExternalIds),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  user: one(users, {
    fields: [predictions.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [predictions.matchId],
    references: [matches.id],
  }),
}));

export const pointEventsRelations = relations(pointEvents, ({ one }) => ({
  user: one(users, {
    fields: [pointEvents.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [pointEvents.matchId],
    references: [matches.id],
  }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievementDefinitions, {
    fields: [userAchievements.achievementId],
    references: [achievementDefinitions.id],
  }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, { fields: [groups.creatorId], references: [users.id] }),
  memberships: many(groupMemberships),
  invitations: many(groupInvitations),
  links: many(groupLinks),
}));

export const groupMembershipsRelations = relations(groupMemberships, ({ one }) => ({
  group: one(groups, { fields: [groupMemberships.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMemberships.userId], references: [users.id] }),
}));

export const groupInvitationsRelations = relations(groupInvitations, ({ one }) => ({
  group: one(groups, { fields: [groupInvitations.groupId], references: [groups.id] }),
  invitee: one(users, { fields: [groupInvitations.inviteeId], references: [users.id] }),
  inviter: one(users, { fields: [groupInvitations.invitedBy], references: [users.id] }),
}));

export const groupLinksRelations = relations(groupLinks, ({ one }) => ({
  group: one(groups, { fields: [groupLinks.groupId], references: [groups.id] }),
}));
