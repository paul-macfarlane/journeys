ALTER TABLE "run" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "ending_step_id" text;--> statement-breakpoint
-- Ticket 75: backfill Runs resting on an Ending (see ADR-0002).
UPDATE "run"
SET
  "completed_at" = "ended_at",
  "ending_step_id" = "path" ->> (jsonb_array_length("path") - 1)
WHERE "ended_at" IS NOT NULL;