import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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

// ─── USERS & AUTH (Auth.js compatible) ─────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    image: text("image"),
    country: varchar("country", { length: 3 }),
    username: varchar("username", { length: 20 }).unique(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
  }),
);

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
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
