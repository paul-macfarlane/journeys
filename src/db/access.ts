// Database access only — `server-only` so a client import fails the build.
import "server-only";

import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import {
  journeyStateColumns,
  summarizeJourney,
  type JourneySummary,
} from "@/db/journeys";
import {
  projectColumns,
  toProjectSummary,
  type ProjectSummary,
} from "@/db/projects";
import { journey, member, project } from "@/db/schema";

/**
 * The membership seam (ticket 82): the only two reads under `src/db` that
 * take a bare user id to decide what an Author may touch. Membership of a
 * Project is the whole authorization rule; everything a Member reads or
 * writes inside a Project or one of its Journeys takes the branded value
 * one of these hands back, so the type system — not a comment — holds the
 * rule that nothing is touched before the check, and nothing downstream
 * checks again.
 *
 * Both return null for a non-Member and for an id that never existed alike,
 * so callers answer both with the same 404 and neither leaks the other.
 * Both are request-scoped `cache()`, like `getSession`: the layout under
 * `[projectId]` and the page beneath it ask for the same Project in one
 * render, and a Journey page hands its one `MemberJourney` to every read it
 * makes, so a render runs each membership join once.
 */

/** Only this module can make one: see the private casts below. */
declare const memberOf: unique symbol;

/** A Project, as resolved for one of its Members. */
export type MemberProject = ProjectSummary & {
  /** The Member it was resolved for — who the writes are made by. */
  memberUserId: string;
  readonly [memberOf]: "project";
};

/** A Journey, as resolved for one of its Project's Members. */
export type MemberJourney = JourneySummary & {
  projectId: string;
  /** The Member it was resolved for — who the writes are made by. */
  memberUserId: string;
  /** Its Project, read in the same query and for the same Member. */
  project: MemberProject;
  readonly [memberOf]: "journey";
};

function asMemberProject(
  summary: ProjectSummary,
  memberUserId: string,
): MemberProject {
  return { ...summary, memberUserId } as MemberProject;
}

/** The Project behind an id, but only for one of its Members. */
export const projectForMember = cache(
  async (projectId: string, userId: string): Promise<MemberProject | null> => {
    const [row] = await db
      .select(projectColumns)
      .from(project)
      .innerJoin(member, eq(member.projectId, project.id))
      .where(and(eq(project.id, projectId), eq(member.userId, userId)))
      .limit(1);

    return row ? asMemberProject(toProjectSummary(row), userId) : null;
  },
);

/**
 * The Journey behind a Project id and Journey id pair, but only for one of
 * the Project's Members — one query joining the Journey, its Project, and the
 * membership, which also reads the Project's own columns, plus the count of
 * Published Versions its publish state is derived from. Null for a
 * non-Member, an unknown Project, and an unknown Journey alike, including a
 * real Journey asked for under the wrong Project.
 */
export const journeyForMember = cache(
  async (
    projectId: string,
    journeyId: string,
    userId: string,
  ): Promise<MemberJourney | null> => {
    const [row] = await db
      .select({ journey: journeyStateColumns, project: projectColumns })
      .from(journey)
      .innerJoin(project, eq(project.id, journey.projectId))
      .innerJoin(member, eq(member.projectId, project.id))
      .where(
        and(
          eq(project.id, projectId),
          eq(journey.id, journeyId),
          eq(member.userId, userId),
        ),
      )
      .limit(1);

    if (!row) return null;

    const summary = await summarizeJourney(row.journey);
    return {
      ...summary,
      projectId: row.project.id,
      memberUserId: userId,
      project: asMemberProject(toProjectSummary(row.project), userId),
    } as MemberJourney;
  },
);
