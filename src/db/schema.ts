// Drizzle schema. The first four tables are Better Auth's own, managed
// through its Drizzle adapter — column names and types are the adapter's
// contract, not ours, so nothing there is extended. Journeys' own domain
// tables follow, each landing with its ticket; Project, Member, Journey,
// Draft, Published Version, and Run are here, and Response follows later.

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import type { GraphDocument } from "@/lib/graph/document";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A Project: a named grouping of Journeys, owned and collaborated on by its
// Members. Text ids generated in the application, matching better-auth's own
// id style above. The id is the Project's address: `/projects/<id>`, which
// nothing else names, so an Author renames a Project freely and its URL
// never moves.
export const project = pgTable("project", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A Member: an Author who belongs to a Project. All Members are equal, so
// `role` is written (defaulting to "member") and never read — it exists so
// adding a distinction later needs no migration of existing rows.
//
// The domain migration also installs a BEFORE DELETE trigger enforcing that a
// Project never loses its last Member. Two consequences, both deliberate:
// deleting a Project still works (its row is already gone when the member
// rows cascade), while deleting a `user` who is some Project's only Member
// is refused — delete or hand over those Projects first. Drizzle snapshots
// don't track triggers, so the statement lives only in the migration file.
export const member = pgTable(
  "member",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

// A Journey: a graph of steps and choices, authored inside one Project.
// Like a Project, a Journey is addressed by its id — inside the Project at
// `/projects/<project-id>/journeys/<journey-id>`, and publicly at
// `/j/<journey-id>` for the participant runner.
//
// A Journey's Draft is the `draft` row below, created with it, and its
// Published Versions are the `published_version` rows further down.
// `liveVersionId` names the one live to participants: null before the first
// publish, and null again after unpublishing, which is why publish state is
// derived from it rather than stored (see `src/lib/publish-state.ts`).
export const journey = pgTable("journey", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // Circular: `published_version` points back at `journey`, so the column
  // type is annotated (`AnyPgColumn`) for TypeScript's benefit.
  liveVersionId: text("live_version_id").references(
    (): AnyPgColumn => publishedVersion.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A Draft: the single mutable working copy of a Journey. One per Journey —
// the primary key is the Journey's own id, so a second Draft cannot be
// written down — and it goes when the Journey does.
//
// The document column holds the whole graph of steps and choices as one JSON
// value. Its shape is owned by `src/lib/graph/document.ts`, not by Postgres
// (see `docs/adr/0001-graph-as-one-json-document.md`): the database stores
// jsonb and the application validates it on the way in and on the way out.
// The row is created with the Journey, and migration 0002 backfills one for
// every Journey that predates this table.
export const draft = pgTable("draft", {
  journeyId: text("journey_id")
    .primaryKey()
    .references(() => journey.id, { onDelete: "cascade" }),
  document: jsonb("document").$type<GraphDocument>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A Published Version: an immutable snapshot of a Journey's Draft, taken the
// moment an Author published it. Nothing ever updates one of these rows —
// later Draft edits become the next version instead — so restoring an older
// version copies its document back into the Draft rather than moving a
// pointer, and unpublishing clears `journey.live_version_id` while every row
// here stays.
//
// The document column holds the same graph shape the Draft does, owned by
// `src/lib/graph/document.ts` (see ADR-0001). `published_by` goes null if the
// account does, because a version outlives the Member who published it.
// `(journey_id, version_number)` is unique, so two publishes racing for the
// same number fail loudly instead of writing a duplicate.
export const publishedVersion = pgTable(
  "published_version",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    journeyId: text("journey_id")
      .notNull()
      .references(() => journey.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    // The title and description participants saw with this version. They
    // live on the Journey row for editing and are copied here at publish
    // time, so renaming a Journey never changes what is live until the next
    // publish. Defaulted so a build older than migration 0004 can still
    // insert; that migration backfills the rows it finds from the Journey.
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    document: jsonb("document").$type<GraphDocument>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedBy: text("published_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [unique().on(table.journeyId, table.versionNumber)],
);

// A Run: one anonymous Participant's walk of a Published Version, pinned to
// it at start so publishing a new version mid-run never changes what an
// in-progress Run reads. There is no `journey_id` column — the version it is
// pinned to already names the Journey — so deleting a Journey cascades its
// Published Versions and, through them, every Run.
//
// `id` is the Run's only write credential (see `src/lib/run-cookies.ts`), so
// it is `crypto.randomUUID()`, unguessable, never sequential.
// `participantId` is a pseudonymous cookie id, never linked to an account.
// `path` is the route walked from the Start, one entry per visit — repeats
// included since ADR-0002 — owned by the pure reducer in
// `src/lib/graph/run.ts`; the current Step is its last entry.
// `backtrackCount`, `endedAt`, and
// `outcomeId` are that reducer's other state, mirrored here so a resumed Run
// reads back exactly the state it left off at. `outcomeId` names an Outcome
// inside the pinned version's document, not a foreign key — Outcomes live
// inside the document (see ADR-0001), not in a table of their own.
export const run = pgTable(
  "run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    versionId: text("version_id")
      .notNull()
      .references(() => publishedVersion.id, { onDelete: "cascade" }),
    participantId: text("participant_id").notNull(),
    path: jsonb("path").$type<string[]>().notNull(),
    backtrackCount: integer("backtrack_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    outcomeId: text("outcome_id"),
  },
  // Ticket 10's per-version analytics read every Run of a version.
  (table) => [index("run_version_id_idx").on(table.versionId)],
);
