CREATE TABLE "published_version" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"document" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" text,
	CONSTRAINT "published_version_journey_id_version_number_unique" UNIQUE("journey_id","version_number")
);
--> statement-breakpoint
ALTER TABLE "journey" ADD COLUMN "live_version_id" text;--> statement-breakpoint
ALTER TABLE "published_version" ADD CONSTRAINT "published_version_journey_id_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_version" ADD CONSTRAINT "published_version_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey" ADD CONSTRAINT "journey_live_version_id_published_version_id_fk" FOREIGN KEY ("live_version_id") REFERENCES "public"."published_version"("id") ON DELETE set null ON UPDATE no action;