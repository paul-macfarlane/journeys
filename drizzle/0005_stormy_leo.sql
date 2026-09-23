CREATE TABLE "run" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"path" jsonb NOT NULL,
	"backtrack_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"outcome_id" text
);
--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_version_id_published_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."published_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_version_id_idx" ON "run" USING btree ("version_id");