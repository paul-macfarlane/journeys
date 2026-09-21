import { describe, expect, it } from "vitest";

import type { Choice, GraphDocument, Step } from "@/lib/graph/document";
import { graphDocumentSchema, isEnding } from "@/lib/graph/document";
import { largeJourney } from "@/lib/graph/fixtures/large-journey";
import type { CanvasNode } from "@/lib/graph/layout";
import { layoutGraph, mapOrder, problemsByAddress } from "@/lib/graph/layout";
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
    const edge = edges.find((candidate) => candidate.id === expected.id);
    // `toMatchObject`, not `toEqual`: every edge also carries dagre's routed
    // `points`, asserted separately below rather than pinned to a literal
    // coordinate list here.
    expect(edge).toMatchObject(expected);
    expect(edge?.points.length).toBeGreaterThanOrEqual(2);
    for (const point of edge?.points ?? []) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  }

  for (const node of nodes) {
    expect(Number.isFinite(node.x)).toBe(true);
    expect(Number.isFinite(node.y)).toBe(true);
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);

    // Every Step's `sourceAnchors` is exactly its own Choice ids (order is
    // asserted by the dedicated `sourceAnchors` cases below); a `missing`
    // placeholder never carries any.
    if (node.kind === "step") {
      expect([...node.sourceAnchors].sort()).toEqual(
        document.steps[node.stepId].choices.map((c) => c.id).sort(),
      );
    } else {
      expect(node.sourceAnchors).toEqual([]);
    }
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

describe("layoutGraph routed edges", () => {
  it("gives every edge finite routed points with at least two entries", () => {
    const { edges } = layoutGraph(graphDocumentSchema.parse(case3));
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
      for (const point of edge.points) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    }
  });

  it("routes a Choice spanning more than one rank through more than its two endpoints", () => {
    // Start has a Choice straight to C and a Choice to A; A leads to B, B
    // leads to C — so Start -> C skips over two ranks A and B occupy.
    // Verified against the installed dagre before asserting: the routed
    // path for Start -> C comes back with interior points beyond its two
    // endpoints, not a two-point straight line.
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "start",
      allowBack: true,
      steps: byId([
        step("start", [
          choice("start-to-a", "Go to A", "a"),
          choice("start-to-c", "Skip to C", "c"),
        ]),
        step("a", [choice("a-to-b", "Go to B", "b")]),
        step("b", [choice("b-to-c", "Go to C", "c")]),
        step("c", [], { title: "End" }),
      ]),
      outcomes: {},
    };

    const { edges } = layoutGraph(document);
    const spanning = edges.find((edge) => edge.id === "start:start-to-c");
    expect(spanning?.points.length).toBeGreaterThan(2);
    for (const point of spanning?.points ?? []) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it("routes two parallel Choices to the same target as their own distinct point arrays, and a self-loop Choice without throwing", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "a",
      allowBack: true,
      steps: byId([
        step("a", [
          choice("a-to-b-1", "Go to B (first way)", "b"),
          choice("a-to-b-2", "Go to B (second way)", "b"),
          choice("a-loops", "Stay put", "a"),
        ]),
        step("b", []),
      ]),
      outcomes: {},
    };

    expect(() => layoutGraph(document)).not.toThrow();
    const { edges } = layoutGraph(document);
    const first = edges.find((edge) => edge.id === "a:a-to-b-1");
    const second = edges.find((edge) => edge.id === "a:a-to-b-2");
    const selfLoop = edges.find((edge) => edge.id === "a:a-loops");

    expect(first?.points).toBeDefined();
    expect(second?.points).toBeDefined();
    expect(first?.points).not.toBe(second?.points);
    expect(first?.points).not.toEqual(second?.points);

    expect(selfLoop?.points.length).toBeGreaterThanOrEqual(2);
    for (const point of selfLoop?.points ?? []) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

describe("CanvasNode.sourceAnchors", () => {
  it("orders a Step's Choices by the x position of the box each one targets", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "s",
      allowBack: true,
      steps: byId([
        step("s", [
          choice("s-to-t1", "Go to T1", "t1"),
          choice("s-to-t2", "Go to T2", "t2"),
          choice("s-to-t3", "Go to T3", "t3"),
        ]),
        step("t1", []),
        step("t2", []),
        step("t3", []),
        // Skews dagre's crossing-minimization order so T1..T3 land in a
        // different left-to-right order than the Choices above list them.
        step("z", [
          choice("z-to-t3", "Go to T3", "t3"),
          choice("z-to-t1", "Go to T1", "t1"),
        ]),
      ]),
      outcomes: {},
    };

    const { nodes } = layoutGraph(document);
    const nodeById = (id: string) =>
      nodes.find((candidate) => candidate.id === id);
    const t1X = nodeById("t1")?.x ?? 0;
    const t2X = nodeById("t2")?.x ?? 0;
    const t3X = nodeById("t3")?.x ?? 0;

    // Not vacuous: the run before this assertion showed the three targets
    // really do land at three different x positions.
    expect(new Set([t1X, t2X, t3X]).size).toBe(3);

    const expectedOrder = (
      [
        ["s-to-t1", t1X],
        ["s-to-t2", t2X],
        ["s-to-t3", t3X],
      ] as const
    )
      .toSorted((left, right) => left[1] - right[1])
      .map(([choiceId]) => choiceId);

    expect(nodeById("s")?.sourceAnchors).toEqual(expectedOrder);
  });

  it("gives a Step with no Choices an empty sourceAnchors list", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "only",
      allowBack: true,
      steps: byId([step("only", [])]),
      outcomes: {},
    };

    const { nodes } = layoutGraph(document);
    expect(nodes[0].sourceAnchors).toEqual([]);
  });
});

describe("mapOrder", () => {
  it("orders the seeded case-3 Steps top to bottom, then left to right, with no placeholders", () => {
    const document = graphDocumentSchema.parse(case3);
    const layout = layoutGraph(document);
    const order = mapOrder(layout);

    const stepIds = Object.keys(document.steps);
    expect(order).toHaveLength(stepIds.length);
    expect([...order].sort()).toEqual([...stepIds].sort());
    expect(order.some((id) => id.startsWith("missing:"))).toBe(false);

    const positions = order.map((id) => {
      const node = layout.nodes.find((candidate) => candidate.id === id);
      return { y: node?.y ?? 0, x: node?.x ?? 0 };
    });
    for (let index = 1; index < positions.length; index += 1) {
      const previous = positions[index - 1];
      const current = positions[index];
      const inOrder =
        current.y > previous.y ||
        (current.y === previous.y && current.x >= previous.x);
      expect(inOrder).toBe(true);
    }
  });

  it("excludes the missing placeholder standing in for a dangling Choice", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "start",
      allowBack: true,
      steps: byId([
        step("start", [choice("choice-to-ghost", "Vanish", "ghost-step")]),
      ]),
      outcomes: {},
    };

    const layout = layoutGraph(document);
    expect(mapOrder(layout)).toEqual(["start"]);
  });
});

describe("layoutGraph determinism", () => {
  it("gives deep-equal output, points and sourceAnchors included, for the same input run twice", () => {
    const document = graphDocumentSchema.parse(case3);
    expect(layoutGraph(document)).toEqual(layoutGraph(document));
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
