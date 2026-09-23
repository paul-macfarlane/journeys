import { describe, expect, it } from "vitest";

import type {
  Choice,
  GraphDocument,
  LayoutDirection,
  Step,
} from "@/lib/graph/document";
import { graphDocumentSchema, isEnding } from "@/lib/graph/document";
import { largeJourney } from "@/lib/graph/fixtures/large-journey";
import type { CanvasNode } from "@/lib/graph/layout";
import {
  EDGE_LABEL_MAX_WIDTH,
  LR_RANK_SEPARATION,
  layoutGraph,
  mapOrder,
  problemsByAddress,
} from "@/lib/graph/layout";
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
function buildGeneratedDocument(
  layoutDirection: LayoutDirection = "TB",
): GraphDocument {
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
    layoutDirection,
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

  for (const [stepId, docStep] of Object.entries(document.steps)) {
    const node = nodes.find((candidate) => candidate.id === stepId);
    expect(node?.isEnding).toBe(isEnding(docStep));
    if (isEnding(docStep)) {
      // Which Outcome an Ending carries, and nothing about where that Outcome
      // sits among the document's: nothing on the map is drawn by Outcome, so
      // the layout has no position to carry.
      expect(node?.outcomeId).toBe(docStep.outcomeId);
      expect(node).not.toHaveProperty("outcomeIndex");
    }
  }

  expect(layoutGraph(document)).toEqual({
    nodes,
    edges,
    direction: document.layoutDirection,
  });
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
      layoutDirection: "TB",
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
    });
    expect(missingNodes[0]).not.toHaveProperty("outcomeIndex");

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
      layoutDirection: "TB",
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
      layoutDirection: "TB",
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
      layoutDirection: "TB",
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

  it("keeps a self-loop Choice's route within or beside its own box", () => {
    const document: GraphDocument = {
      schemaVersion: 1,
      startStepId: "a",
      allowBack: true,
      steps: byId([
        step("a", [
          choice("a-loops", "Stay put", "a"),
          choice("a-to-b", "Move on", "b"),
        ]),
        step("b", []),
      ]),
      outcomes: {},
      layoutDirection: "TB",
    };

    const { nodes, edges } = layoutGraph(document);
    const box = nodes.find((node) => node.id === "a");
    const points = edges.find((edge) => edge.id === "a:a-loops")?.points ?? [];

    expect(box).toBeDefined();
    expect(points.length).toBeGreaterThanOrEqual(2);

    // What dagre actually lays a self-loop out as, pinned: the route stays in
    // the box's own rank — every point's y inside the box's top and bottom —
    // and runs out to the right of it and back, never above, below, or left
    // of the box. On a 220×72 box at (16, 16) that is the zig-zag
    // (377,16) → (267,52) → (157,88) → (267,52), which reads as a line
    // through the box rather than as a loop beside it. The visual is known
    // poor; drawing a proper loop is ticket 19's, and this case is here so
    // that changing it is a deliberate act rather than a silent one.
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(box!.x);
      expect(point.y).toBeGreaterThanOrEqual(box!.y);
      expect(point.y).toBeLessThanOrEqual(box!.y + box!.height);
    }
    expect(Math.max(...points.map((point) => point.x))).toBeGreaterThan(
      box!.x + box!.width,
    );
  });
});

describe("layoutGraph direction", () => {
  /**
   * Every Choice's target lies downstream of its source along the direction
   * dagre laid the map out in: strictly greater on the rank axis, and past
   * the source box's own far edge on that axis, not merely past its centre.
   * `buildGeneratedDocument` is a tree with no self-loop and no dangling
   * Choice, so every edge's source and target are two distinct step nodes.
   */
  function assertTargetsAreDownstream(document: GraphDocument): void {
    const { nodes, edges } = layoutGraph(document);
    const nodeById = (id: string) =>
      nodes.find((candidate) => candidate.id === id);

    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      const source = nodeById(edge.source);
      const target = nodeById(edge.target);
      expect(source).toBeDefined();
      expect(target).toBeDefined();
      if (!source || !target) {
        continue;
      }
      if (document.layoutDirection === "LR") {
        expect(target.x).toBeGreaterThan(source.x + source.width);
      } else {
        expect(target.y).toBeGreaterThan(source.y + source.height);
      }
    }
  }

  it("places every Choice's target strictly right of its source, past its right edge, left to right", () => {
    assertTargetsAreDownstream(buildGeneratedDocument("LR"));
  });

  it("places every Choice's target strictly below its source, past its bottom edge, top to bottom", () => {
    assertTargetsAreDownstream(buildGeneratedDocument("TB"));
  });

  it("carries the document's layoutDirection through as the layout's own direction", () => {
    expect(layoutGraph(buildGeneratedDocument("LR")).direction).toBe("LR");
    expect(layoutGraph(buildGeneratedDocument("TB")).direction).toBe("TB");
  });
});

describe("layoutGraph Choice order", () => {
  /**
   * Ticket 25: the boxes a Step's Choices lead to sit in Choice order across
   * the map — leftmost first top to bottom, topmost first left to right —
   * so the map reads the same way round as the panel's Choice list. The `z`
   * Step below skews dagre's own ordering phase so that, left to dagre, the
   * three targets land in a different order than the Choices list them.
   */
  function threeWayBranch(layoutDirection: LayoutDirection): GraphDocument {
    return {
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
        step("z", [
          choice("z-to-t3", "Go to T3", "t3"),
          choice("z-to-t1", "Go to T1", "t1"),
        ]),
      ]),
      outcomes: {},
      layoutDirection,
    };
  }

  /**
   * The rule itself, checked over a whole document: walking the Steps in
   * reading order — rank by rank, the Start first in its rank, then across
   * each rank — the distinct boxes down the map from each Step that share a
   * rank and have not been placed by an earlier Step sit in Choice order
   * along the cross axis.
   */
  function assertTargetsInChoiceOrder(document: GraphDocument): void {
    const layout = layoutGraph(document);
    const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
    const rankOf = (node: CanvasNode) =>
      document.layoutDirection === "LR" ? node.x : node.y;
    const crossOf = (node: CanvasNode) =>
      document.layoutDirection === "LR" ? node.y : node.x;

    const readingOrder = layout.nodes
      .filter((node) => node.kind === "step")
      .toSorted(
        (a, b) =>
          rankOf(a) - rankOf(b) ||
          Number(b.isStart) - Number(a.isStart) ||
          crossOf(a) - crossOf(b),
      )
      .map((node) => node.id);

    const placed = new Set<string>();
    let groupsChecked = 0;
    for (const stepId of readingOrder) {
      const reader = nodeById.get(stepId);
      expect(reader).toBeDefined();
      if (!reader) continue;

      const targets: CanvasNode[] = [];
      for (const choiceEntry of document.steps[stepId].choices) {
        const targetId = Object.hasOwn(document.steps, choiceEntry.targetStepId)
          ? choiceEntry.targetStepId
          : `missing:${choiceEntry.targetStepId}`;
        const target = nodeById.get(targetId);
        expect(target).toBeDefined();
        if (
          !target ||
          rankOf(target) <= rankOf(reader) ||
          placed.has(targetId) ||
          targets.includes(target)
        ) {
          continue;
        }
        targets.push(target);
      }

      const byRank = new Map<number, CanvasNode[]>();
      for (const target of targets) {
        placed.add(target.id);
        const group = byRank.get(rankOf(target)) ?? [];
        group.push(target);
        byRank.set(rankOf(target), group);
      }
      for (const group of byRank.values()) {
        if (group.length < 2) continue;
        groupsChecked += 1;
        for (let index = 1; index < group.length; index += 1) {
          expect(
            crossOf(group[index]),
            `${stepId}: "${group[index].id}" is not past "${group[index - 1].id}" across the map`,
          ).toBeGreaterThan(crossOf(group[index - 1]));
        }
      }
    }
    // Not vacuous: the document has branches to check.
    expect(groupsChecked).toBeGreaterThan(0);
  }

  it("puts a three-way branch's targets left to right in Choice order, top to bottom", () => {
    const document = threeWayBranch("TB");
    const { nodes } = layoutGraph(document);
    const nodeById = (id: string) =>
      nodes.find((candidate) => candidate.id === id);

    const t1 = nodeById("t1");
    const t2 = nodeById("t2");
    const t3 = nodeById("t3");
    expect(t1 && t2 && t3).toBeTruthy();
    if (!t1 || !t2 || !t3) return;

    // All three share the rank below the Start.
    expect(new Set([t1.y, t2.y, t3.y]).size).toBe(1);
    expect(t1.x).toBeLessThan(t2.x);
    expect(t2.x).toBeLessThan(t3.x);
    // And the anchors follow, so the arrows leave the Start in Choice order.
    expect(nodeById("s")?.sourceAnchors).toEqual([
      "s-to-t1",
      "s-to-t2",
      "s-to-t3",
    ]);
    assertNoOverlaps(nodes);
    assertTargetsInChoiceOrder(document);
  });

  it("puts a three-way branch's targets top to bottom in Choice order, left to right", () => {
    const document = threeWayBranch("LR");
    const { nodes } = layoutGraph(document);
    const nodeById = (id: string) =>
      nodes.find((candidate) => candidate.id === id);

    const t1 = nodeById("t1");
    const t2 = nodeById("t2");
    const t3 = nodeById("t3");
    expect(t1 && t2 && t3).toBeTruthy();
    if (!t1 || !t2 || !t3) return;

    expect(new Set([t1.x, t2.x, t3.x]).size).toBe(1);
    expect(t1.y).toBeLessThan(t2.y);
    expect(t2.y).toBeLessThan(t3.y);
    expect(nodeById("s")?.sourceAnchors).toEqual([
      "s-to-t1",
      "s-to-t2",
      "s-to-t3",
    ]);
    assertNoOverlaps(nodes);
    assertTargetsInChoiceOrder(document);
  });

  it("puts targets that share their one parent in Choice order, not the order the Steps were made in", () => {
    // With no other Step leading to any of the three, every target hangs off
    // the Start alone, and the Steps were made in the reverse of the order
    // the Start's Choices list them.
    for (const layoutDirection of ["TB", "LR"] as const) {
      const document: GraphDocument = {
        schemaVersion: 1,
        startStepId: "s",
        allowBack: true,
        steps: byId([
          step("t3", []),
          step("t2", []),
          step("t1", []),
          step("s", [
            choice("s-to-t1", "Go to T1", "t1"),
            choice("s-to-t2", "Go to T2", "t2"),
            choice("s-to-t3", "Go to T3", "t3"),
          ]),
        ]),
        outcomes: {},
        layoutDirection,
      };

      const { nodes } = layoutGraph(document);
      const crossOf = (id: string) => {
        const node = nodes.find((candidate) => candidate.id === id);
        return layoutDirection === "LR" ? (node?.y ?? 0) : (node?.x ?? 0);
      };
      expect(crossOf("t1")).toBeLessThan(crossOf("t2"));
      expect(crossOf("t2")).toBeLessThan(crossOf("t3"));
      expect(nodes.find((node) => node.id === "s")?.sourceAnchors).toEqual([
        "s-to-t1",
        "s-to-t2",
        "s-to-t3",
      ]);
      assertTargetsInChoiceOrder(document);
    }
  });

  it("keeps the seeded case-3 targets in Choice order in both directions, without a dagre throw", () => {
    const seeded = graphDocumentSchema.parse(case3);
    for (const layoutDirection of ["TB", "LR"] as const) {
      const document = { ...seeded, layoutDirection };
      expect(() => layoutGraph(document)).not.toThrow();
      assertTargetsInChoiceOrder(document);
      assertNoOverlaps(layoutGraph(document).nodes);
    }
  });

  it("widens the gap between ranks left to right so a label can sit between boxes", () => {
    const document = threeWayBranch("LR");
    const { nodes } = layoutGraph(document);
    const nodeById = (id: string) =>
      nodes.find((candidate) => candidate.id === id);
    const start = nodeById("s");
    const t1 = nodeById("t1");
    expect(start && t1).toBeTruthy();
    if (!start || !t1) return;

    expect(t1.x - (start.x + start.width)).toBeGreaterThanOrEqual(
      LR_RANK_SEPARATION,
    );
    expect(LR_RANK_SEPARATION).toBeGreaterThan(EDGE_LABEL_MAX_WIDTH);
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
      layoutDirection: "TB",
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

  it("orders a Step's Choices by the y position of the box each one targets, left to right", () => {
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
        // different top-to-bottom order than the Choices above list them.
        step("z", [
          choice("z-to-t3", "Go to T3", "t3"),
          choice("z-to-t1", "Go to T1", "t1"),
        ]),
      ]),
      outcomes: {},
      layoutDirection: "LR",
    };

    const { nodes } = layoutGraph(document);
    const nodeById = (id: string) =>
      nodes.find((candidate) => candidate.id === id);
    const t1Y = nodeById("t1")?.y ?? 0;
    const t2Y = nodeById("t2")?.y ?? 0;
    const t3Y = nodeById("t3")?.y ?? 0;

    // Not vacuous: the run before this assertion showed the three targets
    // really do land at three different y positions.
    expect(new Set([t1Y, t2Y, t3Y]).size).toBe(3);

    const expectedOrder = (
      [
        ["s-to-t1", t1Y],
        ["s-to-t2", t2Y],
        ["s-to-t3", t3Y],
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
      layoutDirection: "TB",
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
      layoutDirection: "TB",
    };

    const layout = layoutGraph(document);
    expect(mapOrder(layout)).toEqual(["start"]);
  });

  it("orders the Steps of a left-to-right case-3 map top to bottom, then left to right, with no placeholders", () => {
    const document = {
      ...graphDocumentSchema.parse(case3),
      layoutDirection: "LR" as const,
    };
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
});

describe("layoutGraph determinism", () => {
  it("gives deep-equal output, points and sourceAnchors included, for the same input run twice", () => {
    const document = graphDocumentSchema.parse(case3);
    expect(layoutGraph(document)).toEqual(layoutGraph(document));
  });

  it("gives deep-equal output for the same left-to-right input run twice", () => {
    const document = {
      ...graphDocumentSchema.parse(case3),
      layoutDirection: "LR" as const,
    };
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
        // Tagged with an Outcome the document does not define, so this Step
        // carries two problems of its own: nothing reaches it, and its tag
        // names an Outcome that is gone.
        step("orphan", [], {
          title: "Orphan ending",
          outcomeId: "outcome-renamed-away",
        }),
      ]),
      outcomes: {},
      layoutDirection: "TB",
    };

    const problems = validateForPublish(document);
    expect(problems.map((problem) => problem.code)).toEqual([
      "dangling-choice-target",
      "unreachable-step",
      "unknown-outcome",
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
      layoutDirection: "TB",
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
