ALTER TABLE "journey" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Hand-written below this line: every Journey created before this column
-- existed is numbered by its `created_at` within its Project, 0 first, so
-- a Project's list opens oldest first and "Move up" / "Move down" edit that
-- order from there. Ties on `created_at` break on id, so the numbering is
-- deterministic. Drizzle snapshots do not track data, so this statement
-- lives only here.
WITH "ordered" AS (
	SELECT "id",
		ROW_NUMBER() OVER (PARTITION BY "project_id" ORDER BY "created_at", "id") - 1 AS "position"
	FROM "journey"
)
UPDATE "journey"
SET "position" = "ordered"."position"
FROM "ordered"
WHERE "journey"."id" = "ordered"."id";
