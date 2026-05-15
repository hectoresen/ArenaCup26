ALTER TABLE "users" ADD COLUMN "avatar_id" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_changed_at" timestamp with time zone;