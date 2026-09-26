import { describe, expect, it } from "vitest";

import type { RunPath } from "@/lib/analytics";
import { analyticsForVersion } from "@/lib/analytics";
import type { Content } from "@/lib/graph/content";
import type {
  Choice,
  GraphDocument,
  Outcome,
  Step,
} from "@/lib/graph/document";
import { layoutGraph, mapOrder } from "@/lib/graph/layout";
import { validateForPublish } from "@/lib/graph/validate";
import { groupResponsesByStep, type ResponseRow } from "@/lib/response-list";

/**
 * Postgres's `jsonb` does not keep the key order a document was written
 * with, so every pure function that reads a `GraphDocument`'s `steps` or
 * `outcomes` must give the same answer whichever order those keys come
 * back in. This is the one table test that pins that down across the
 * functions the Editor, the Publish dialog, the canvas, Analytics, and the
 * Responses tab each depend on.
 */

const emptyContent: Content = { type: "doc", content: [{ type: "paragraph" }] };

function choice(id: string, targetStepId: string): Choice {
  return { id, label: "Go on", targetStepId, condition: null, effect: null };
}

function step(
  id: string,
  choices: Choice[],
  outcomeId: string | null = null,
): Step {
  return {
    id,
    title: id,
    content: emptyContent,
    choices,
    prompt:
      id === "left"
        ? {
            type: "free_text",
            label: "What did you notice?",
            required: false,
            decides: false,
          }
        : null,
    outcomeId,
    position: null,
  };
}

const outcome: Outcome = { id: "outcome-a", label: "Reached the end" };

/**
 * A small diamond, every Step reachable from the Start: start branches to
 * left and right, both merge on end. Reversing `steps` or `outcomes`
 * changes nothing about the graph itself.
 */
function buildDocument(reverseKeys: boolean): GraphDocument {
  const steps: Step[] = [
    step("start", [
      choice("choice-left", "left"),
      choice("choice-right", "right"),
    ]),
    step("left", [choice("choice-l-end", "end")]),
    step("right", [choice("choice-r-end", "end")]),
    step("end", [], outcome.id),
  ];
  const orderedSteps = reverseKeys ? [...steps].reverse() : steps;
  const orderedOutcomes = reverseKeys ? [outcome] : [outcome];

  return {
    schemaVersion: 1,
    startStepId: "start",
    allowBack: true,
    steps: Object.fromEntries(orderedSteps.map((one) => [one.id, one])),
    outcomes: Object.fromEntries(orderedOutcomes.map((one) => [one.id, one])),
    layoutDirection: "TB",
  };
}

const runs: RunPath[] = [
  { versionId: "v1", path: ["start", "left", "end"] },
  { versionId: "v1", path: ["start", "right", "end"] },
  { versionId: "v1", path: ["start", "left"] },
];

const responseRows: ResponseRow[] = [
  { stepId: "left", text: "A shortcut", createdAt: new Date("2026-01-01") },
];

/** Node and edge order in `layoutGraph`'s own output follows `steps`'s key
 * order, which is exactly the thing jsonb does not preserve — so what a
 * reader must find identical is each id's own geometry, not array position. */
function byId<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

describe("key-order invariance (steps and outcomes)", () => {
  const original = buildDocument(false);
  const reversed = buildDocument(true);

  it("documents differ only in key order, not in content", () => {
    expect(Object.keys(original.steps)).not.toEqual(
      Object.keys(reversed.steps),
    );
    expect(original.steps).toEqual(reversed.steps);
  });

  it("layoutGraph places every node and edge identically", () => {
    const a = layoutGraph(original);
    const b = layoutGraph(reversed);

    expect(byId(a.nodes)).toEqual(byId(b.nodes));
    expect(byId(a.edges)).toEqual(byId(b.edges));
    expect(a.direction).toBe(b.direction);
  });

  it("mapOrder gives the same map order", () => {
    expect(mapOrder(layoutGraph(original))).toEqual(
      mapOrder(layoutGraph(reversed)),
    );
  });

  it("validateForPublish gives the same problem list", () => {
    expect(validateForPublish(original)).toEqual(validateForPublish(reversed));
  });

  it("analyticsForVersion gives the same numbers", () => {
    expect(analyticsForVersion("v1", original, runs)).toEqual(
      analyticsForVersion("v1", reversed, runs),
    );
  });

  it("groupResponsesByStep gives the same groups", () => {
    expect(groupResponsesByStep(original, responseRows)).toEqual(
      groupResponsesByStep(reversed, responseRows),
    );
  });
});
