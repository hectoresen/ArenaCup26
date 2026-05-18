CREATE TYPE "public"."group_invitation_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."group_member_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."group_visibility" AS ENUM('public', 'private');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'group_invited';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'group_joined';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'group_left';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'group_expelled';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'group_admin_transferred';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'group_deleted';--> statement-breakpoint
CREATE TABLE "group_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"status" "group_invitation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"token" text NOT NULL,
	"max_uses" integer DEFAULT 0 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "group_member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"frozen_points" integer,
	"frozen_streak_max" integer,
	"frozen_simple_hits" integer
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"visibility" "group_visibility" DEFAULT 'private' NOT NULL,
	"max_members" integer DEFAULT 25 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_links" ADD CONSTRAINT "group_links_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_invitations_invitee_idx" ON "group_invitations" USING btree ("invitee_id","status");--> statement-breakpoint
CREATE INDEX "group_invitations_group_idx" ON "group_invitations" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_links_token_unique" ON "group_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "group_links_group_active_idx" ON "group_links" USING btree ("group_id","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_unique" ON "group_memberships" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "group_memberships_user_idx" ON "group_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_memberships_group_active_idx" ON "group_memberships" USING btree ("group_id","left_at");--> statement-breakpoint
CREATE INDEX "groups_creator_idx" ON "groups" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "groups_visibility_idx" ON "groups" USING btree ("visibility");