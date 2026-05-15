CREATE TABLE "ranking_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"total_points" integer NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_snapshots_unique_day" ON "ranking_snapshots" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "ranking_snapshots_date_idx" ON "ranking_snapshots" USING btree ("snapshot_date");