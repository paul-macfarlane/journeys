ALTER TABLE "project" ADD COLUMN "description_content" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL;--> statement-breakpoint
-- Hand-written below this line: every Project described in plain text before
-- this column existed keeps that description as rich text — one paragraph
-- per non-blank line, trimmed, in the order they were written — so the
-- public Project page (ticket 07) shows what the Author wrote. A Project with
-- a blank description keeps the empty document the column defaults to. The
-- plain `description` column is left as it was for the build that still
-- reads it (see the schema comment). Drizzle snapshots do not track data, so
-- this statement lives only here.
WITH "lines" AS (
	SELECT "project"."id", btrim("line"."text") AS "text", "line"."ordinal"
	FROM "project",
		regexp_split_to_table("project"."description", E'\\r?\\n') WITH ORDINALITY AS "line"("text", "ordinal")
),
"paragraphs" AS (
	SELECT "id",
		jsonb_agg(
			jsonb_build_object(
				'type', 'paragraph',
				'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', "text"))
			)
			ORDER BY "ordinal"
		) AS "blocks"
	FROM "lines"
	WHERE "text" <> ''
	GROUP BY "id"
)
UPDATE "project"
SET "description_content" = jsonb_build_object('type', 'doc', 'content', "paragraphs"."blocks")
FROM "paragraphs"
WHERE "project"."id" = "paragraphs"."id";
