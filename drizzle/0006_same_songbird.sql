ALTER TABLE "user_points" ADD COLUMN "streak_max" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_points" ADD COLUMN "simple_hits" integer DEFAULT 0 NOT NULL;