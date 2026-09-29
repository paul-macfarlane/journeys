import { describe, expect, it } from "vitest";

import { createDraftDocument, type GraphDocument } from "@/lib/graph/document";
import { draftPending, publishStateOf } from "@/lib/publish-state";

/**
 * Seam A for ticket 05: the rule that turns a Journey's live-version pointer
 * and its count of Published Versions into the state the badge reads.
 *
 * Expected values are the three states named in the ticket, written out
 * rather than derived the way the function derives them.
 */
describe("publishStateOf", () => {
  it("is never published when the Journey has no version and no live one", () => {
    expect(publishStateOf({ liveVersionId: null, versionCount: 0 })).toBe(
      "never-published",
    );
  });

  it("is published while the Journey points at a live version", () => {
    expect(
      publishStateOf({ liveVersionId: "version-1", versionCount: 1 }),
    ).toBe("published");
  });

  it("is unpublished once versions exist but none is live", () => {
    expect(publishStateOf({ liveVersionId: null, versionCount: 2 })).toBe(
      "unpublished",
    );
  });
});

/**
 * Ticket 82: what the Journey page shows about changes participants are not
 * yet seeing — the "Unpublished changes" note, Publish's enablement, and the
 * Draft row's timestamp on the Versions tab — as one pure rule. Expected
 * values are the worked cases below, written out by hand.
 */
describe("draftPending", () => {
  const document = createDraftDocument();
  const edited: GraphDocument = {
    ...document,
    steps: {
      [document.startStepId]: {
        ...document.steps[document.startStepId],
        title: "Border",
      },
    },
  };
  const earlier = new Date("2026-09-26T10:00:00Z");
  const later = new Date("2026-09-26T11:00:00Z");
  const journey = {
    title: "Border Crossing",
    description: "A journey",
    updatedAt: later,
  };
  const live = {
    kind: "ok" as const,
    title: "Border Crossing",
    description: "A journey",
    document,
  };

  it("has nothing pending while participants see exactly the Draft, title, and description", () => {
    expect(
      draftPending({
        journey,
        draft: { document, updatedAt: earlier },
        live,
      }),
    ).toEqual({
      hasUnpublishedChanges: false,
      // The Journey row moved later (a publish, say), but its title and
      // description are what is live, so the Draft's own save is shown.
      draftEditedAt: earlier,
    });
  });

  it("has everything pending on a Journey with no live version, dated by the later edit", () => {
    expect(
      draftPending({
        journey,
        draft: { document, updatedAt: earlier },
        live: null,
      }),
    ).toEqual({
      hasUnpublishedChanges: true,
      draftEditedAt: later,
    });
  });

  it("counts a renamed Journey as pending, dated by the rename when it came after the Draft's save", () => {
    expect(
      draftPending({
        journey: { ...journey, title: "Night crossing" },
        draft: { document, updatedAt: earlier },
        live,
      }),
    ).toEqual({
      hasUnpublishedChanges: true,
      draftEditedAt: later,
    });
  });

  it("dates a pending title by the Draft's save when that came later", () => {
    expect(
      draftPending({
        journey: { ...journey, description: "Changed", updatedAt: earlier },
        draft: { document, updatedAt: later },
        live,
      }),
    ).toMatchObject({ hasUnpublishedChanges: true, draftEditedAt: later });
  });

  it("counts an edited Draft document as pending, dated by the Draft's save alone", () => {
    expect(
      draftPending({
        journey,
        draft: { document: edited, updatedAt: earlier },
        live,
      }),
    ).toEqual({
      hasUnpublishedChanges: true,
      draftEditedAt: earlier,
    });
  });

  it("keeps Publish on offer for a Draft that cannot be read", () => {
    expect(
      draftPending({
        journey,
        draft: { document: null, updatedAt: earlier },
        live,
      }),
    ).toEqual({
      hasUnpublishedChanges: true,
      draftEditedAt: earlier,
    });
  });

  it("keeps Publish on offer while the live version cannot be read", () => {
    expect(
      draftPending({
        journey,
        draft: { document, updatedAt: earlier },
        live: { kind: "unreadable" },
      }),
    ).toEqual({
      hasUnpublishedChanges: true,
      draftEditedAt: later,
    });
  });
});
