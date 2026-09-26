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

function choice(id: string, targetStepId: string, label = "Go on"): Choice {
  return { id, label, targetStepId, condition: null, effect: null };
}

function step(
  id: string,
  choices: Choice[],
  options: { title?: string; outcomeId?: string; prompt?: string } = {},
): Step {
  return {
    id,
    title: options.title ?? id,
    content: emptyContent,
    choices,
    prompt:
      options.prompt === undefined
        ? null
        : {
            type: "free_text",
            label: options.prompt,
            required: false,
            decides: false,
          },
    outcomeId: options.outcomeId ?? null,
    position: null,
  };
}

const foundKey: Outcome = { id: "outcome-key", label: "Found the key" };
const wentHome: Outcome = { id: "outcome-home", label: "Went home" };

/**
 * A Journey that breaks more than one publish rule, each on more than one
 * Step, so the order within a rule is something the test can see:
 *
 * - the Start branches to `left` and `right`; `left` ends on `found` (tagged
 *   with one Outcome) and `dead-end-a`, `right` on `home` (tagged with the
 *   other) and `dead-end-b`;
 * - two blank Choice labels (on the Start and on `right`);
 * - two Choices pointing at Steps that no longer exist (on `left` and
 *   `right`);
 * - two untagged Endings with the same title (`dead-end-a`, `dead-end-b`),
 *   so Analytics has a tie only a key can break;
 * - two unreachable Steps with Prompts (`orphan-z`, `orphan-a`), written in
 *   the opposite order to their ids.
 */
function buildDocument(reverseKeys: boolean): GraphDocument {
  const steps: Step[] = [
    step(
      "start",
      [choice("choice-left", "left"), choice("choice-right", "right", "")],
      { prompt: "Why are you here?" },
    ),
    step(
      "left",
      [
        choice("choice-l-found", "found"),
        choice("choice-l-gone", "gone-left"),
        choice("choice-l-dead", "dead-end-a"),
      ],
      { prompt: "What did you notice?" },
    ),
    step(
      "right",
      [
        choice("choice-r-home", "home", "  "),
        choice("choice-r-gone", "gone-right"),
        choice("choice-r-dead", "dead-end-b"),
      ],
      { prompt: "Which way now?" },
    ),
    step("found", [], { outcomeId: foundKey.id }),
    step("home", [], { outcomeId: wentHome.id }),
    step("dead-end-a", [], { title: "Lost" }),
    step("dead-end-b", [], { title: "Lost" }),
    step("orphan-z", [choice("choice-z-a", "orphan-a")], {
      prompt: "Anyone there?",
    }),
    step("orphan-a", [], { prompt: "Still nobody?" }),
  ];
  const outcomes = [foundKey, wentHome];
  const orderedSteps = reverseKeys ? [...steps].reverse() : steps;
  const orderedOutcomes = reverseKeys ? [...outcomes].reverse() : outcomes;

  return {
    schemaVersion: 1,
    startStepId: "start",
    allowBack: true,
    steps: Object.fromEntries(orderedSteps.map((one) => [one.id, one])),
    outcomes: Object.fromEntries(orderedOutcomes.map((one) => [one.id, one])),
    layoutDirection: "TB",
  };
}

/** One Run into each Ending, so every group ties with another on runs. */
const runs: RunPath[] = [
  { versionId: "v1", path: ["start", "left", "found"] },
  { versionId: "v1", path: ["start", "right", "home"] },
  { versionId: "v1", path: ["start", "left", "dead-end-a"] },
  { versionId: "v1", path: ["start", "right", "dead-end-b"] },
  { versionId: "v1", path: ["start", "left"] },
];

const responseRows: ResponseRow[] = [
  { stepId: "right", text: "Downhill", createdAt: new Date("2026-01-01") },
  { stepId: "left", text: "A shortcut", createdAt: new Date("2026-01-02") },
  { stepId: "orphan-z", text: "Hello?", createdAt: new Date("2026-01-03") },
  { stepId: "orphan-a", text: "No", createdAt: new Date("2026-01-04") },
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
    expect(Object.keys(original.outcomes)).not.toEqual(
      Object.keys(reversed.outcomes),
    );
    expect(original.steps).toEqual(reversed.steps);
    expect(original.outcomes).toEqual(reversed.outcomes);
  });

  it("layoutGraph places every node and edge identically", () => {
    const a = layoutGraph(original);
    const b = layoutGraph(reversed);

    // Nine Steps and every Choice whose target exists (eight of ten).
    expect(a.nodes.filter((node) => node.kind === "step")).toHaveLength(9);
    expect(a.edges.length).toBeGreaterThanOrEqual(8);
    expect(byId(a.nodes)).toEqual(byId(b.nodes));
    expect(byId(a.edges)).toEqual(byId(b.edges));
    expect(a.direction).toBe(b.direction);
  });

  it("mapOrder gives the same map order", () => {
    const a = mapOrder(layoutGraph(original));

    expect(a).toHaveLength(9);
    expect(a).toEqual(mapOrder(layoutGraph(reversed)));
  });

  it("validateForPublish gives the same problem list", () => {
    const a = validateForPublish(original);

    expect(a.map((problem) => problem.code)).toEqual([
      "dangling-choice-target",
      "dangling-choice-target",
      "empty-choice-label",
      "empty-choice-label",
      "unreachable-step",
      "unreachable-step",
    ]);
    expect(a).toEqual(validateForPublish(reversed));
  });

  it("analyticsForVersion gives the same numbers", () => {
    const a = analyticsForVersion("v1", original, runs);

    // One Run each, so by label: "Found the key", the two "Lost" Endings by
    // key, "Went home", then orphan-a (an untitled Ending no Run reached).
    expect(a.outcomes.map((group) => group.key)).toEqual([
      "outcome:outcome-key",
      "ending:dead-end-a",
      "ending:dead-end-b",
      "outcome:outcome-home",
      "ending:orphan-a",
      "abandoned",
    ]);
    expect(a).toEqual(analyticsForVersion("v1", reversed, runs));
  });

  it("groupResponsesByStep gives the same groups", () => {
    const a = groupResponsesByStep(original, responseRows);

    expect(a.map((group) => group.stepId)).toEqual([
      "start",
      "left",
      "right",
      "orphan-a",
      "orphan-z",
    ]);
    expect(a).toEqual(groupResponsesByStep(reversed, responseRows));
  });
});
