// Drizzle schema. The first four tables are Better Auth's own, managed
// through its Drizzle adapter — column names and types are the adapter's
// contract, not ours, so nothing there is extended except for the three
// Journeys-owned columns `user` carries beside the adapter's own (ticket 52).
// Journeys' own domain tables follow, each landing with its ticket; Project,
// Member, Journey, Draft, Published Version, Run, and Response are here.

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

import type { Content } from "@/lib/graph/content";
import type { GraphDocument } from "@/lib/graph/document";
import type { AuthorLink } from "@/lib/author";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Author page (ticket 52). `bio` is plain text, null when never written;
  // `links` is the closed `{ kind, url }` list `src/lib/author.ts` defines,
  // at most five, one per kind; `public` is the Author's opt-in — off, the
  // page at `/authors/<id>` is a 404 like an unknown id. All three carry
  // defaults so a build older than migration 0010 still inserts.
  bio: text("bio"),
  links: jsonb("links").$type<AuthorLink[]>().notNull().default([]),
  public: boolean("public").notNull().default(false),
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
  // The Project's description as rich text — the same closed `Content` shape
  // a Step's text has, edited with the same editor and sanitized on write by
  // `sanitizeContent` (see `src/lib/graph/content.ts`). Shown under the title
  // on the public Project page (`/p/<id>`). Defaulted to the empty document
  // so a build older than migration 0007 still inserts.
  descriptionContent: jsonb("description_content")
    .$type<Content>()
    .notNull()
    .default({ type: "doc", content: [] }),
  // The Project's Theme (ticket 11): one of the preset ids in
  // `src/lib/theme.ts` and an optional `#rrggbb` accent, painted on the
  // runner and the public Project page. A Journey may override both (see
  // `journey.themePreset` below). Defaulted to the app's own palette so a
  // build older than migration 0009 still inserts, and so every Project
  // that predates the column keeps looking as it did.
  themePreset: text("theme_preset").notNull().default("trail"),
  themeAccent: text("theme_accent"),
  // Reserved and unused (spec, Data model): where a custom token set would
  // go if a Theme ever became more than a preset and an accent. Nothing
  // reads or writes it; it is here so adding that needs no migration.
  themeCustomTokens: jsonb("theme_custom_tokens").$type<
    Record<string, string>
  >(),
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
  // Where the Journey sits in its Project's list, 0 first: set by the Author
  // with "Move up" / "Move down", appended at the end on creation, and read
  // in `position` then `created_at` order (see `@/lib/journey-order`).
  // Defaulted so a build older than migration 0006 still inserts; that
  // migration numbers every Journey that predates the column by
  // `created_at` within its Project.
  position: integer("position").notNull().default(0),
  // The Journey's Theme override (ticket 11). Null preset means "the
  // Project's Theme", which is every Journey until an Author says
  // otherwise; a set preset is taken whole, with this accent or none — the
  // Project's accent is never layered under it. Both nullable, so a build
  // older than migration 0009 still inserts.
  themePreset: text("theme_preset"),
  themeAccent: text("theme_accent"),
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
//
// `version` counts the Draft's writes (ticket 73): every save and restore
// sends the version it read and is stored only while it still matches,
// incrementing it; a mismatch is another Member's write, refused as stale.
// Added with a default by migration 0011, so code that never reads it keeps
// working while the migration runs.
export const draft = pgTable("draft", {
  journeyId: text("journey_id")
    .primaryKey()
    .references(() => journey.id, { onDelete: "cascade" }),
  document: jsonb("document").$type<GraphDocument>().notNull(),
  version: integer("version").notNull().default(0),
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

// A Response: one Participant's answer to a Step's Prompt within one Run.
// Keyed by Run and Step (spec: "stored in its own table keyed by Run and
// step id"), so a Participant who backtracks to a Step and answers again
// replaces what they wrote rather than leaving two answers to one question,
// and a revisit can show them their own words. `step_id` names a Step inside
// the Run's pinned Published Version, not a foreign key — Steps live inside
// the document (see ADR-0001). A Run's Prompt-less Steps have no row here:
// skipping an optional Prompt writes nothing.
//
// Rides on the Run for authorization the way the Run rides on its cookie:
// the runner's action writes a Response only for the Run its cookie names,
// and Members read Responses through the Journey their Project owns. There is
// no participant column — the Run already carries the pseudonymous id, and a
// Response list for Members must never show one. Cascades with the Run, so
// deleting a Journey or a Project takes every Response with it.
export const response = pgTable(
  "response",
  {
    runId: text("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    stepId: text("step_id").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.stepId] })],
);
