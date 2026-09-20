// Drizzle schema. The first four tables are Better Auth's own, managed
// through its Drizzle adapter — column names and types are the adapter's
// contract, not ours, so nothing there is extended. Journeys' own domain
// tables follow, each landing with its ticket; Project, Member, Journey and
// Draft are here, and Published Version, Run and Response follow later.

import {
  boolean,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
// `/j/<journey-id>` once ticket 06 builds the runner.
//
// A Journey's Draft is the `draft` row below, created with it. There is no
// live-version pointer yet: publish state is derived, not stored, and ticket
// 05 adds the pointer a Journey needs to have ever been published. Until then
// every Journey reads as "Never published".
export const journey = pgTable("journey", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
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
