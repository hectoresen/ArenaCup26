ALTER TABLE "users" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "users_is_bot_idx" ON "users" USING btree ("is_bot") WHERE "users"."is_bot" = true;