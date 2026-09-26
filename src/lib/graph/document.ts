import { z } from "zod";

import { contentSchema, sanitizeContent } from "@/lib/graph/content";

/**
 * The graph document: the whole of a Journey's Draft, and the whole of every
 * Published Version, in one validated shape. Deliberately no `server-only` —
 * the editor, the participant runner, the seed script, and the e2e specs all
 * read it. See `docs/adr/0001-graph-as-one-json-document.md`.
 */

/**
 * Ids are opaque non-empty strings. App code mints them with
 * `crypto.randomUUID()`; readable ids such as `step-07` stay valid so the
 * seed script and the fixtures can be read by a person.
 */
export const idSchema = z.string().min(1);

/**
 * A Choice leads a participant from one Step to another. `condition` and
 * `effect` are reserved for a later ticket: nothing reads them today, and
 * nothing should start to without a decision to do so.
 */
export const choiceSchema = z.object({
  id: idSchema,
  label: z.string(),
  targetStepId: idSchema,
  condition: z.string().nullable().default(null),
  effect: z.string().nullable().default(null),
});

/**
 * An optional question a participant may answer before choosing. `type` is a
 * discriminator reserved for later kinds of Prompt; free text is the only
 * accepted value today.
 *
 * `decides` (ticket 43): the Response is judged by an AI reader against the
 * Step's Choices, and a confident judgment advances the Run along it instead
 * of showing Choice buttons. Defaults to `false` so every document stored
 * before ticket 43 parses unchanged. `setStepPrompt` forces `required: true`
 * whenever `decides` is true — a Response nothing can judge is not a Prompt
 * worth showing Choices around — so `readResponse` in `prompt.ts` treats a
 * deciding Prompt as required independent of the stored `required` flag.
 */
export const promptSchema = z.object({
  type: z.literal("free_text"),
  label: z.string(),
  required: z.boolean(),
  decides: z.boolean().default(false),
});

/** An Author-defined label that groups Endings for analysis. */
export const outcomeSchema = z.object({
  id: idSchema,
  label: z.string(),
});

/**
 * How the Canvas lays a Journey's map out: top to bottom or left to right.
 * `"RL"` and any other value are refused — only these two are drawable today.
 */
export const layoutDirectionSchema = z.enum(["TB", "LR"]);
export type LayoutDirection = z.infer<typeof layoutDirectionSchema>;

/**
 * Everything about a Step except how strictly its rich text is read. The
 * write path reads content loosely so it can sanitize before storing; every
 * other caller reads it strictly.
 */
function stepSchemaWith<C extends z.ZodType>(content: C) {
  return z.object({
    id: idSchema,
    title: z.string().max(200),
    content,
    choices: z.array(choiceSchema),
    prompt: promptSchema.nullable(),
    outcomeId: idSchema.nullable(),
    position: z.object({ x: z.number(), y: z.number() }).nullable(),
  });
}

/**
 * One screen a participant reads. A Step with no Choices is an Ending, and
 * may carry the id of an Outcome that groups it. `position` is reserved for
 * the canvas.
 */
export const stepSchema = stepSchemaWith(contentSchema);

/** The only thing the key/id check needs to know about what it is checking. */
type Addressed = { id: string };

/**
 * The key is the address; a Step or Outcome filed under a different id than
 * its own is a structural error, not a publish-time problem.
 */
function checkKeysMatchIds(
  document: {
    steps: Record<string, Addressed>;
    outcomes: Record<string, Addressed>;
  },
  ctx: z.RefinementCtx,
): void {
  for (const [key, step] of Object.entries(document.steps)) {
    if (step.id !== key) {
      ctx.addIssue({
        code: "custom",
        path: ["steps", key, "id"],
        message: `Step is filed under "${key}" but calls itself "${step.id}"`,
      });
    }
  }
  for (const [key, outcome] of Object.entries(document.outcomes)) {
    if (outcome.id !== key) {
      ctx.addIssue({
        code: "custom",
        path: ["outcomes", key, "id"],
        message: `Outcome is filed under "${key}" but calls itself "${outcome.id}"`,
      });
    }
  }
}

/**
 * The envelope around whichever Step schema is in play, so the strict shape
 * and the write path's loose shape agree on everything but rich text.
 *
 * `layoutDirection` is a property of the Journey, not of any one Author: its
 * Members share one view of the map and may switch it back and forth freely.
 * It lives in the Draft document and autosaves with every other edit, last
 * write wins; publishing copies it into the Published Version with the rest
 * of the document. Nothing reads it at run time — it only ever steers
 * `layoutGraph`. Step positions are still never stored here.
 */
function graphDocumentSchemaWith<S extends z.ZodType<Addressed>>(step: S) {
  return z
    .object({
      schemaVersion: z.literal(1),
      startStepId: idSchema,
      allowBack: z.boolean().default(true),
      steps: z.record(idSchema, step),
      outcomes: z.record(idSchema, outcomeSchema),
      layoutDirection: layoutDirectionSchema.default("TB"),
    })
    .superRefine(checkKeysMatchIds);
}

/**
 * `startStepId` is a single pointer, so "more than one Start" cannot be
 * written down at all; the publish rule "exactly one Start" reduces to "the
 * pointer names a Step that exists". `allowBack` is reserved: nothing reads
 * it yet.
 */
export const graphDocumentSchema = graphDocumentSchemaWith(stepSchema);

/**
 * The same envelope with every Step's rich text left unread, so raw editor
 * output can be checked structurally before it is sanitized. Private: only
 * `prepareDocumentForWrite` may hand out a document parsed this loosely.
 */
const looseGraphDocumentSchema = graphDocumentSchemaWith(
  stepSchemaWith(z.unknown()),
);

export type Choice = z.infer<typeof choiceSchema>;
export type Prompt = z.infer<typeof promptSchema>;
export type Outcome = z.infer<typeof outcomeSchema>;
export type Step = z.infer<typeof stepSchema>;
export type GraphDocument = z.infer<typeof graphDocumentSchema>;

/** An Ending is a Step a participant cannot walk on from. */
export function isEnding(step: Step): boolean {
  return step.choices.length === 0;
}

/** What an Author calls the Step, falling back to its id when untitled. */
export function stepName(step: Step): string {
  return step.title.trim().length > 0 ? step.title : step.id;
}

/**
 * Own properties only. The maps are plain objects parsed from JSON, so an id
 * such as "toString" or "constructor" would otherwise find a prototype
 * method and count as a Step or Outcome that exists.
 */
export function hasStep(document: GraphDocument, stepId: string): boolean {
  return Object.hasOwn(document.steps, stepId);
}

export function hasOutcome(
  document: GraphDocument,
  outcomeId: string,
): boolean {
  return Object.hasOwn(document.outcomes, outcomeId);
}

/**
 * Every Step in walk order: the Start, then breadth-first through each
 * Step's Choices in their own order, then every Step the Start cannot reach,
 * sorted by id. The order comes from the graph, never from `document.steps`'s
 * own key order, which Postgres's jsonb does not keep. With no Start there is
 * nowhere to walk from, so every Step is in the sorted tail. `reached` is the
 * set the walk found, for callers that need to tell the two parts apart.
 */
export function walkSteps(document: GraphDocument): {
  order: string[];
  reached: Set<string>;
} {
  const reached = new Set<string>();
  const order: string[] = [];
  const pending = hasStep(document, document.startStepId)
    ? [document.startStepId]
    : [];

  while (pending.length > 0) {
    const stepId = pending.shift();
    if (stepId === undefined || reached.has(stepId)) continue;
    if (!hasStep(document, stepId)) continue;
    reached.add(stepId);
    order.push(stepId);
    for (const choice of document.steps[stepId].choices) {
      pending.push(choice.targetStepId);
    }
  }

  const unreached = Object.keys(document.steps)
    .filter((stepId) => !reached.has(stepId))
    .sort();

  return { order: [...order, ...unreached], reached };
}

/**
 * The first problem with the path it was found at, because a caller showing
 * an Author one message is better served by a precise one.
 */
function firstIssueMessage(error: {
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>;
}): string {
  const [issue] = error.issues;
  const path = issue.path.join(".");
  return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
}

export type PrepareDocumentResult =
  | { ok: true; document: GraphDocument }
  | { ok: false; error: string; stepId?: string };

/**
 * The only entry point a write path may use. Raw editor output is not in
 * stored shape yet — the editor's Link extension adds a `nofollow` rel and a
 * target, and pasted text arrives with elements the contract does not keep —
 * so reading it strictly would reject writes the sanitizer exists to clean.
 *
 * Loose parse, then sanitize every Step's rich text, then strict parse: what
 * comes back is always the sanitized stored shape. `stepId` is set only when
 * a particular Step's content was refused, so the Author can be sent to it.
 */
export function prepareDocumentForWrite(input: unknown): PrepareDocumentResult {
  const loose = looseGraphDocumentSchema.safeParse(input);
  if (!loose.success) {
    return { ok: false, error: firstIssueMessage(loose.error) };
  }

  const steps: Record<string, unknown> = {};
  for (const [stepId, step] of Object.entries(loose.data.steps)) {
    const sanitized = sanitizeContent(step.content);
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.error, stepId };
    }
    steps[stepId] = { ...step, content: sanitized.content };
  }

  const stored = graphDocumentSchema.safeParse({ ...loose.data, steps });
  // The sanitizer promises content that satisfies the strict shape, so this
  // failing means the sanitizer is wrong. Say so rather than throwing: the
  // Author gets a message instead of the caller getting an exception.
  return stored.success
    ? { ok: true, document: stored.data }
    : { ok: false, error: firstIssueMessage(stored.error) };
}

/**
 * A brand-new Draft: one Step, which is the Start, holding the empty
 * paragraph the editor emits for empty rich text. Every field is written
 * out, so what is built here is exactly what is stored and read back.
 */
export function createDraftDocument(): GraphDocument {
  const startStepId = crypto.randomUUID();

  return {
    schemaVersion: 1,
    startStepId,
    allowBack: true,
    steps: {
      [startStepId]: {
        id: startStepId,
        title: "Start",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        choices: [],
        prompt: null,
        outcomeId: null,
        position: null,
      },
    },
    outcomes: {},
    layoutDirection: "TB",
  };
}

/**
 * JSON with every object's keys in sorted order, so two documents that mean
 * the same thing compare equal however their keys happen to be ordered —
 * Postgres reorders jsonb keys, and the editor and the seed write them in
 * their own orders.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Whether two documents describe the same Journey — the same Steps, Choices,
 * Outcomes, and rich text. Used to tell a Draft that has moved on from the
 * live Published Version from one that has not.
 */
export function documentsEqual(a: GraphDocument, b: GraphDocument): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
