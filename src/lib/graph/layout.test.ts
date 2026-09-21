import { describe, expect, it } from "vitest";

import type { Choice, GraphDocument, Step } from "@/lib/graph/document";
import { graphDocumentSchema, isEnding } from "@/lib/graph/document";
import { largeJourney } from "@/lib/graph/fixtures/large-journey";
import type { CanvasNode } from "@/lib/graph/layout";
import { layoutGraph, problemsByAddress } from "@/lib/graph/layout";
import { validateForPublish } from "@/lib/graph/validate";

import case3 from "../../../scripts/seed/journey-stories/case-3.json";

/**
 * Seam A for ticket 09: `layoutGraph` and `problemsByAddress`, exercised
 * through the one public interface the canvas calls. Every layout case also
 * checks that the input document is left exactly as it was — a deep-equal
 * snapshot taken before the call — because the module never mutates what it
 * is given.
 */

function choice(id: string, label: string, targetStepId: string): Choice {
  return { id, label, targetStepId, condition: null, effect: null };
}

function step(
  id: string,
  choices: Choice[],
  options: { title?: string; outcomeId?: string } = {},
): Step {
  return {
    id,
    title: options.title ?? id,
    content: { type: "doc", content: [{ type: "paragraph" }] },
    choices,
    prompt: null,
    outcomeId: options.outcomeId ?? null,
    position: null,
  };
}

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

/**
 * A generated 60-Step branching document: a binary tree built breadth-first
 * from a single Start, so it has well over the 6 Endings ticket 09 asks
 * for and stays a plain tree (no cycles, nothing unreachable, no dangling
 * Choices) so `assertLayoutMatchesDocument` can be reused on it as-is.
 */
function buildGeneratedDocument(): GraphDocument {
  const total = 60;
  const ids = Array.from({ length: total }, (_, index) => `gen-${index}`);
  const children: number[][] = Array.from({ length: total }, () => []);

  let nextIndex = 1;
  const queue: number[] = [0];
  while (nextIndex < total && queue.length > 0) {
    const parent = queue.shift();
    if (parent === undefined) {
      break;
    }
    for (let branch = 0; branch < 2 && nextIndex < total; branch += 1) {
      children[parent].push(nextIndex);
      queue.push(nextIndex);
      nextIndex += 1;
    }
  }

  const outcomeIds = ["gen-outcome-a", "gen-outcome-b"];
  let leafCount = 0;
  const steps = ids.map((id, index) => {
    const kids = children[index];
    const isLeaf = kids.length === 0;
    const outcomeId = isLeaf ? outcomeIds[leafCount % 2] : undefined;
    if (isLeaf) {
      leafCount += 1;
    }
    return step(
      id,
      kids.map((kidIndex, choiceIndex) =>
        choice(
          `${id}-choice-${choiceIndex}`,
          `Go on ${choiceIndex}`,
          ids[kidIndex],
        ),
      ),
      { title: `Generated step ${index}`, outcomeId },
    );
  });

  return {
    schemaVersion: 1,
    startStepId: ids[0],
    allowBack: true,
    steps: byId(steps),
    outcomes: byId(outcomeIds.map((id) => ({ id, label: id }))),
  };
}

function rectanglesOverlap(a: CanvasNode, b: CanvasNode): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function assertNoOverlaps(nodes: CanvasNode[]): void {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      expect(rectanglesOverlap(nodes[i], nodes[j])).toBe(false);
    }
  }
}

/** Every assertion ticket 09 asks for, shared across the three documents. */
function assertLayoutMatchesDocument(document: GraphDocument): void {
  const before = structuredClone(document);
  const { nodes, edges } = layoutGraph(document);

  const stepIds = Object.keys(document.steps);
  const stepNodes = nodes.filter((node) => node.kind === "step");
  expect(stepNodes).toHaveLength(stepIds.length);
  expect(stepNodes.map((node) => node.id).sort()).toEqual([...stepIds].sort());

  const expectedEdges = stepIds.flatMap((stepId) =>
    document.steps[stepId].choices.map((choiceEntry) => ({
      id: `${stepId}:${choiceEntry.id}`,
      stepId,
      choiceId: choiceEntry.id,
      source: stepId,
      target: Object.hasOwn(document.steps, choiceEntry.targetStepId)
        ? choiceEntry.targetStepId
        : `missing:${choiceEntry.targetStepId}`,
      label: choiceEntry.label,
    })),
  );
  expect(edges).toHaveLength(expectedEdges.length);
  for (const expected of expectedEdges) {
    expect(edges.find((edge) => edge.id === expected.id)).toEqual(expected);
  }

  for (const node of nodes) {
    expect(Number.isFinite(node.x)).toBe(true);
    expect(Number.isFinite(node.y)).toBe(true);
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
  }

  assertNoOverlaps(nodes);

  expect(nodes.filter((node) => node.isStart).map((node) => node.id)).toEqual([
    document.startStepId,
  ]);

  const outcomeIds = Object.keys(document.outcomes);
  for (const [stepId, docStep] of Object.entries(document.steps)) {
    const node = nodes.find((candidate) => candidate.id === stepId);
    expect(node?.isEnding).toBe(isEnding(docStep));
    if (isEnding(docStep)) {
      expect(node?.outcomeId).toBe(docStep.outcomeId);
      const expectedIndex =
        docStep.outcomeId !== null && outcomeIds.includes(docStep.outcomeId)
          ? outcomeIds.indexOf(docStep.outcomeId)
          : null;
      expect(node?.outcomeIndex).toBe(expectedIndex);
    }
  }

  expect(layoutGraph(document)).toEqual({ nodes, edges });
  expect(document).toEqual(before);
}

describe("layoutGraph", () => {
  it("lays out the seeded case-3 journey with one node per step and one edge per choice", () => {
    assertLayoutMatchesDocument(graphDocumentSchema.parse(case3));
  });

  it("lays out the large journey fixture with one node per step and one edge per choice", () => {
    assertLayoutMatchesDocument(largeJourney);
  });

  it("lays out a generated 60-step branching journey with one node per step and one edge per choice", () => {
    assertLayoutMatchesDocument(buildGeneratedDocument());
  });

  it("gives a dangling choice a single missing placeholder node its edge targets", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "start",
      allowBack: true,
      steps: byId([
        step("start", [choice("choice-to-ghost", "Vanish", "ghost-step")]),
      ]),
      outcomes: {},
    };

    const { nodes, edges } = layoutGraph(document);
    const missingNodes = nodes.filter((node) => node.kind === "missing");
    expect(missingNodes).toHaveLength(1);
    expect(missingNodes[0]).toMatchObject({
      id: "missing:ghost-step",
      kind: "missing",
      stepId: "ghost-step",
      title: "Missing step",
      isStart: false,
      isEnding: false,
      outcomeId: null,
      outcomeIndex: null,
    });

    const edge = edges.find(
      (candidate) => candidate.id === "start:choice-to-ghost",
    );
    expect(edge?.target).toBe("missing:ghost-step");
  });

  it("shares one missing node between two choices dangling to the same target", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "start",
      allowBack: true,
      steps: byId([
        step("start", [
          choice("choice-a", "Vanish A", "ghost-step"),
          choice("choice-b", "Vanish B", "ghost-step"),
        ]),
      ]),
      outcomes: {},
    };

    const { nodes, edges } = layoutGraph(document);
    const missingNodes = nodes.filter((node) => node.kind === "missing");
    expect(missingNodes).toHaveLength(1);
    expect(
      edges.filter((edge) => edge.target === "missing:ghost-step"),
    ).toHaveLength(2);
  });
});

describe("problemsByAddress", () => {
  it("groups validateForPublish problems by step and by choice, preserving order", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "start",
      allowBack: true,
      steps: byId([
        step("start", [choice("choice-dangling", "Go nowhere", "ghost")]),
        step("orphan", [], { title: "Orphan ending" }),
      ]),
      outcomes: {},
    };

    const problems = validateForPublish(document);
    expect(problems.map((problem) => problem.code)).toEqual([
      "dangling-choice-target",
      "unreachable-step",
      "ending-without-outcome",
    ]);

    const { steps, choices } = problemsByAddress(problems);

    expect(steps.get("start")).toEqual([problems[0]]);
    expect(steps.get("orphan")).toEqual([problems[1], problems[2]]);
    expect(choices.get("start:choice-dangling")).toEqual([problems[0]]);
  });

  it("drops missing-start problems, which have no address", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "ghost-start",
      allowBack: true,
      steps: byId([
        step("only", [choice("choice-dangling", "Go nowhere", "ghost")]),
      ]),
      outcomes: {},
    };

    const problems = validateForPublish(document);
    expect(problems.some((problem) => problem.code === "missing-start")).toBe(
      true,
    );

    const { steps, choices } = problemsByAddress(problems);
    const grouped = [...steps.values(), ...choices.values()].flat();
    expect(grouped.some((problem) => problem.code === "missing-start")).toBe(
      false,
    );
    expect(steps.get("only")).toEqual([problems[1]]);
  });
});
