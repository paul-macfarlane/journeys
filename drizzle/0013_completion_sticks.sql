ALTER TABLE "run" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "ending_step_id" text;--> statement-breakpoint
-- Ticket 75: backfill for every Run already resting on an Ending. A Run that
-- backtracked off an Ending before this migration cannot be backfilled — its
-- path was truncated, so there is nothing left to read the Ending from
-- (`docs/adr/0002-cycles-and-back-navigation.md`, "Analytics contract for
-- ticket 10" amendment).
UPDATE "run"
SET
  "completed_at" = "ended_at",
  "ending_step_id" = "path" ->> (jsonb_array_length("path") - 1)
WHERE "ended_at" IS NOT NULL;