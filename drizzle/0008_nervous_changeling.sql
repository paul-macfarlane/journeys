CREATE TABLE "response" (
	"run_id" text NOT NULL,
	"step_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "response_run_id_step_id_pk" PRIMARY KEY("run_id","step_id")
);
--> statement-breakpoint
ALTER TABLE "response" ADD CONSTRAINT "response_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;