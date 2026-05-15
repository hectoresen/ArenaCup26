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
};

export const DEFAULT_USER_PRIVACY: UserPrivacy = {
  visibility: "public",
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
  "friend_request",
  "friend_accepted",
]);

export const friendshipStatusEnum = pgEnum("friendship_status", [
  "pending",
  "accepted",
  "blocked",
]);

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
  },
  (table) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
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
    snapshotDate: timestamp("snapshot_date", { mode: "date", withTimezone: false })
      .notNull(),
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
