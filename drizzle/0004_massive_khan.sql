ALTER TABLE "published_version" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "published_version" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Hand-written below this line: a version published before these columns
-- existed showed the Journey's title and description as they were, and the
-- closest record of that is the Journey row today. Drizzle snapshots do not
-- track data, so this statement lives only here.
UPDATE "published_version" v
SET "title" = j."title", "description" = j."description"
FROM "journey" j
WHERE j."id" = v."journey_id" AND v."title" = '' AND v."description" = '';
