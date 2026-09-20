CREATE TABLE "member" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Hand-written below this line: a Project can never lose its last Member.
-- Drizzle snapshots do not track functions or triggers, so this statement
-- lives only here; `src/db/schema.ts` documents it next to the member table.
CREATE OR REPLACE FUNCTION "project_keeps_last_member"() RETURNS trigger AS $$
BEGIN
	-- When the Project row itself is gone the member rows are cascading from
	-- its delete, which is allowed; only a Member being removed from a
	-- surviving Project is refused.
	IF EXISTS (SELECT 1 FROM "project" WHERE "id" = OLD."project_id")
		AND (SELECT count(*) FROM "member" WHERE "project_id" = OLD."project_id") <= 1
	THEN
		RAISE EXCEPTION 'project % must keep at least one member', OLD."project_id";
	END IF;
	RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "member_project_keeps_last_member" ON "member";--> statement-breakpoint
CREATE TRIGGER "member_project_keeps_last_member"
	BEFORE DELETE ON "member"
	FOR EACH ROW
	EXECUTE FUNCTION "project_keeps_last_member"();
