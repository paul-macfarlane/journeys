import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { createDraftDocument } from "@/lib/graph/document";
import type { Theme } from "@/lib/theme";

import { toPublicJourney, toRunForJourney } from "./runs";

const theme: Theme = { preset: "trail", accent: null };

/**
 * Ticket 83: `getPublicJourney`'s live-version row is read with
 * `safeParse`. A live Published Version whose document fails the contract
 * answers the same "unavailable" a Journey with no live version gets, never
 * a throw — the runner's unavailable page (status 200) is what a
 * Participant sees either way.
 */
describe("toPublicJourney", () => {
  const document = createDraftDocument();
  const row = {
    journeyId: "journey-1",
    versionId: "version-1",
    title: "Border Crossing",
    description: "A journey",
    document,
    projectId: "project-1",
    projectTitle: "Refugee Health",
    theme,
  };

  it("reads a row whose document satisfies the contract as live", () => {
    expect(toPublicJourney(row)).toEqual({
      kind: "live",
      versionId: "version-1",
      title: "Border Crossing",
      description: "A journey",
      document,
      theme,
      projectId: "project-1",
      projectTitle: "Refugee Health",
    });
  });

  it("reads a row whose document fails the contract as unavailable", () => {
    expect(
      toPublicJourney({
        ...row,
        document: { schemaVersion: 1, steps: "not a map" },
      }),
    ).toEqual({ kind: "unavailable", theme });
  });
});

/**
 * `getRunForJourney`'s row is read the same way, plus its `path`: a Run
 * whose Published Version document or path fails its contract answers
 * null, exactly as a Run pinned to a replaced version does today, so the
 * step page restarts it from the Start rather than 500ing.
 */
describe("toRunForJourney", () => {
  const document = createDraftDocument();
  const startStepId = document.startStepId;
  const row = {
    run: {
      id: "run-1",
      versionId: "version-1",
      participantId: "participant-1",
      path: [startStepId],
      backtrackCount: 0,
      startedAt: new Date("2026-09-26T12:00:00Z"),
      endedAt: null,
      outcomeId: null,
    },
    version: { title: "Border Crossing", description: "A journey", document },
    project: { id: "project-1", title: "Refugee Health" },
    theme,
  };

  it("reads a row whose document and path satisfy their contracts", () => {
    expect(toRunForJourney(row)).toEqual(row);
  });

  it("answers null for a row whose document fails its contract", () => {
    expect(
      toRunForJourney({
        ...row,
        version: {
          ...row.version,
          document: { schemaVersion: 1, steps: "not a map" },
        },
      }),
    ).toBe(null);
  });

  it("answers null for a row whose path fails its contract", () => {
    expect(
      toRunForJourney({
        ...row,
        run: { ...row.run, path: [1, 2] as unknown as string[] },
      }),
    ).toBe(null);
  });
});
