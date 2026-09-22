ALTER TABLE "journey" ADD COLUMN "theme_preset" text;--> statement-breakpoint
ALTER TABLE "journey" ADD COLUMN "theme_accent" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "theme_preset" text DEFAULT 'trail' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "theme_accent" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "theme_custom_tokens" jsonb;