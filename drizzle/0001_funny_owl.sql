CREATE TABLE "match_external_ids" (
	"match_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	CONSTRAINT "match_external_ids_source_external_id_pk" PRIMARY KEY("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "team_external_ids" (
	"team_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	CONSTRAINT "team_external_ids_source_external_id_pk" PRIMARY KEY("source","external_id")
);
--> statement-breakpoint
ALTER TABLE "match_external_ids" ADD CONSTRAINT "match_external_ids_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_external_ids" ADD CONSTRAINT "team_external_ids_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_external_ids_match_idx" ON "match_external_ids" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "team_external_ids_team_idx" ON "team_external_ids" USING btree ("team_id");