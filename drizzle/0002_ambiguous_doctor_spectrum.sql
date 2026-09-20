CREATE TABLE "draft" (
	"journey_id" text PRIMARY KEY NOT NULL,
	"document" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_journey_id_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journey"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Hand-written below this line: every Journey created before this table
-- existed gets the Draft it would have been created with. The shape built
-- here is exactly what `createDraftDocument()` in src/lib/graph/document.ts
-- produces — one Start Step titled "Start" holding the empty paragraph, no
-- Outcomes — so a backfilled row parses like any other. Drizzle snapshots do
-- not track data, so this statement lives only here.
INSERT INTO "draft" ("journey_id", "document")
SELECT j."id",
	jsonb_build_object(
		'schemaVersion', 1,
		'startStepId', s."id",
		'allowBack', true,
		'steps', jsonb_build_object(s."id", jsonb_build_object(
			'id', s."id",
			'title', 'Start',
			'content', jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph'))),
			'choices', '[]'::jsonb,
			'prompt', NULL,
			'outcomeId', NULL,
			'position', NULL)),
		'outcomes', '{}'::jsonb)
FROM "journey" j
CROSS JOIN LATERAL (SELECT gen_random_uuid()::text AS "id") s
ON CONFLICT ("journey_id") DO NOTHING;